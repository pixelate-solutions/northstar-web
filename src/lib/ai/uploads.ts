import "server-only";

import crypto from "node:crypto";

import { del, head, put } from "@vercel/blob";

/**
 * Chat attachments. Files are streamed to OpenAI's multipart Uploads API in parts small enough for Vercel's
 * request limit, then referenced by file id. Ids are handed to clients with an HMAC so a user can only attach
 * files they uploaded themselves.
 */

/** Bytes per part sent through our API (Vercel caps request bodies at ~4.5 MB). */
export const UPLOAD_PART_BYTES = 4 * 1024 * 1024;
/** OpenAI's limits for file inputs: each file and the whole request. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_REQUEST_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 10;

export type AttachmentKind = "image" | "file";

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const DOCUMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  html: "text/html",
  htm: "text/html",
  xml: "application/xml",
};

/** Plain-text source and config files the model reads as text. */
const TEXT_EXTENSIONS = new Set(
  "asm bat c cc conf cpp cs css cxx def dic eml go h hpp hxx ics ini java js jsx kt log lua m mjs php pl py rb rs rst scala sh sql srt svg swift tex toml ts tsx tsv vcf vtt yaml yml".split(
    " "
  )
);

/** Resolves a filename/MIME pair to what we'll send OpenAI, or null if the model can't read it. */
export function classifyAttachment(filename: string, mimeType: string): { kind: AttachmentKind; mimeType: string } | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (IMAGE_TYPES[ext]) return { kind: "image", mimeType: IMAGE_TYPES[ext] };
  if (Object.values(IMAGE_TYPES).includes(mimeType)) return { kind: "image", mimeType };
  if (DOCUMENT_TYPES[ext]) return { kind: "file", mimeType: DOCUMENT_TYPES[ext] };
  if (TEXT_EXTENSIONS.has(ext)) return { kind: "file", mimeType: "text/plain" };
  if (Object.values(DOCUMENT_TYPES).includes(mimeType)) return { kind: "file", mimeType };
  if (mimeType.startsWith("text/")) return { kind: "file", mimeType: "text/plain" };
  return null;
}

export function sanitizeFilename(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 160) || "upload";
}

// --- Signed references ---------------------------------------------------------------------------

function secret() {
  const value = process.env.AI_UPLOAD_SECRET?.trim() || process.env.CLERK_SECRET_KEY?.trim();
  if (!value) throw new Error("Uploads aren't configured on this server.");
  return value;
}

export function signReference(userId: number, id: string) {
  return crypto.createHmac("sha256", secret()).update(`${userId}:${id}`).digest("base64url");
}

export function verifyReference(userId: number, id: string, signature: unknown) {
  if (typeof signature !== "string" || !signature) return false;
  const expected = Buffer.from(signReference(userId, id));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export interface AttachmentRecord {
  fileId: string;
  filename: string;
  mimeType: string;
  bytes: number;
  kind: AttachmentKind;
  /** Our own copy for viewing in the chat (OpenAI won't hand user_data files back). */
  blobUrl?: string;
}

/** Signs a small JSON payload for one user: `<base64url json>.<hmac>`. */
export function seal(userId: number, payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signReference(userId, body)}`;
}

/** Returns the payload if it was sealed for this user, else null. */
export function unseal<T>(userId: number, token: unknown): T | null {
  if (typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !verifyReference(userId, body, signature)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

// --- OpenAI Uploads API --------------------------------------------------------------------------

async function openai<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for Northstar AI uploads.");
  const send = () =>
    fetch(`https://api.openai.com/v1${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) },
      cache: "no-store",
    });
  let response = await send();
  if (response.status >= 500) response = await send(); // one retry on OpenAI server errors
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI upload error (${response.status}): ${body || response.statusText}`);
  }
  return (await response.json()) as T;
}

export function createUpload(input: { filename: string; bytes: number; mimeType: string; kind: AttachmentKind }) {
  return openai<{ id: string }>("/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // "user_data" works for images and documents ("vision" currently fails with a server error on /uploads).
      purpose: "user_data",
      filename: input.filename,
      bytes: input.bytes,
      mime_type: input.mimeType,
    }),
  });
}

export function addUploadPart(uploadId: string, data: Blob) {
  const form = new FormData();
  form.set("data", data, "part");
  return openai<{ id: string }>(`/uploads/${encodeURIComponent(uploadId)}/parts`, { method: "POST", body: form });
}

export function completeUpload(uploadId: string, partIds: string[]) {
  return openai<{ id: string; status: string; file?: { id: string; bytes?: number; filename?: string } }>(
    `/uploads/${encodeURIComponent(uploadId)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ part_ids: partIds }),
    }
  );
}

// --- Viewable copies (Vercel Blob) ----------------------------------------------------------------

/** Best-effort: a missing Blob store or a failed copy leaves the upload working, just not viewable. */
function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const partPath = (uploadId: string, partId: string) => `chat-uploads/${uploadId}/${partId}`;

export async function storePartCopy(uploadId: string, partId: string, data: Blob) {
  if (!blobConfigured()) return;
  try {
    await put(partPath(uploadId, partId), data, { access: "public", addRandomSuffix: false, allowOverwrite: true });
  } catch (error) {
    console.error("attachment copy failed", error);
  }
}

/** Joins the stored parts into one file and returns its URL, or undefined if any part is missing. */
export async function assembleCopy(userId: number, uploadId: string, partIds: string[], filename: string, mimeType: string) {
  if (!blobConfigured()) return undefined;
  const paths = partIds.map((partId) => partPath(uploadId, partId));
  try {
    const parts: Buffer[] = [];
    for (const path of paths) {
      const { url } = await head(path);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`part ${path}: ${response.status}`);
      parts.push(Buffer.from(await response.arrayBuffer()));
    }
    const file = await put(`chat/${userId}/${filename}`, Buffer.concat(parts), { access: "public", addRandomSuffix: true, contentType: mimeType });
    return file.url;
  } catch (error) {
    console.error("attachment assemble failed", error);
    return undefined;
  } finally {
    await del(paths).catch(() => undefined);
  }
}
