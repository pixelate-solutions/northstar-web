import { NextResponse } from "next/server";

import {
  classifyAttachment,
  createUpload,
  MAX_FILE_BYTES,
  sanitizeFilename,
  seal,
  UPLOAD_PART_BYTES,
} from "@/lib/ai/uploads";
import { requireRouteTripContext } from "@/lib/route-auth";

export const runtime = "nodejs";

/** Starts a chat attachment upload. The client then sends parts of `partBytes` and completes it. */
export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) return context.error;

  const body = (await request.json().catch(() => null)) as { filename?: string; mimeType?: string; bytes?: number } | null;
  const filename = sanitizeFilename(String(body?.filename ?? ""));
  const bytes = Number(body?.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (bytes > MAX_FILE_BYTES) return NextResponse.json({ error: `${filename} is too large. Files can be up to 50 MB.` }, { status: 413 });
  const type = classifyAttachment(filename, String(body?.mimeType ?? ""));
  if (!type) return NextResponse.json({ error: `${filename} isn't a file type Northstar can read.` }, { status: 415 });

  try {
    const upload = await createUpload({ filename, bytes, mimeType: type.mimeType, kind: type.kind });
    const token = seal(context.appUser.id, {
      uploadId: upload.id,
      filename,
      mimeType: type.mimeType,
      kind: type.kind,
      bytes,
      expires: Date.now() + 60 * 60 * 1000,
    });
    return NextResponse.json({ token, partBytes: UPLOAD_PART_BYTES, kind: type.kind });
  } catch (error) {
    console.error("upload start failed", error);
    return NextResponse.json({ error: "Couldn't start the upload. Try again." }, { status: 502 });
  }
}
