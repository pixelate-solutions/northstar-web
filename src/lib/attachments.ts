"use client";

import { tripHeaders } from "@/lib/api-client";

/** Chat attachments in the browser: type checks, image downscaling, and chunked uploads to /api/ai/uploads. */

export const ATTACHMENT_ACCEPT = [
  "image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif",
  ".pdf,.doc,.docx,.rtf,.odt,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.markdown,.json,.html,.htm,.xml",
  ".c,.cc,.cpp,.cs,.css,.go,.h,.hpp,.ics,.ini,.java,.js,.jsx,.kt,.log,.php,.py,.rb,.rs,.sh,.sql,.swift,.tex,.toml,.ts,.tsx,.tsv,.yaml,.yml",
].join(",");

export const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MODEL_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
/** Longest edge for images sent to the model; larger photos are scaled down (faster, same answers). */
const MAX_IMAGE_EDGE = 2048;

export interface UploadedAttachment {
  ref: string;
  filename: string;
  mimeType: string;
  bytes: number;
  kind: "image" | "file";
}

export function isImage(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name);
}

/**
 * Converts formats the model can't read (HEIC) and scales very large photos down to JPEG.
 * Returns the original file when it's already fine.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!isImage(file)) return file;
  const needsConvert = !MODEL_IMAGE_TYPES.has(file.type);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (needsConvert) throw new Error(`${file.name} is an image format this browser can't convert. Try a JPEG or PNG.`);
    return file;
  }
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  if (!needsConvert && scale === 1) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

async function readError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(data?.error ?? fallback);
}

/** Uploads one file in parts (each under Vercel's request limit). `onProgress` gets 0…1. */
export async function uploadAttachment(original: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<UploadedAttachment> {
  const file = await prepareImage(original);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is too large. Files can be up to 50 MB.`);
  const start = await fetch("/api/ai/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tripHeaders() },
    body: JSON.stringify({ filename: file.name || "pasted", mimeType: file.type, bytes: file.size }),
    signal,
  });
  if (!start.ok) throw await readError(start, `Couldn't upload ${file.name}.`);
  const { token, partBytes } = (await start.json()) as { token: string; partBytes: number };

  const partIds: string[] = [];
  for (let offset = 0; offset < file.size; offset += partBytes) {
    const part = await fetch("/api/ai/uploads/parts", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "x-upload-token": token, ...tripHeaders() },
      body: file.slice(offset, offset + partBytes),
      signal,
    });
    if (!part.ok) throw await readError(part, `Couldn't upload ${file.name}.`);
    partIds.push(((await part.json()) as { partId: string }).partId);
    onProgress?.(Math.min(0.95, (offset + partBytes) / file.size));
  }

  const done = await fetch("/api/ai/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...tripHeaders() },
    body: JSON.stringify({ token, partIds }),
    signal,
  });
  if (!done.ok) throw await readError(done, `Couldn't upload ${file.name}.`);
  onProgress?.(1);
  return (await done.json()) as UploadedAttachment;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
