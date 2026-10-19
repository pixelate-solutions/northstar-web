import { NextResponse } from "next/server";

import { completeUpload, seal, unseal, type AttachmentKind, type AttachmentRecord } from "@/lib/ai/uploads";
import { requireRouteTripContext } from "@/lib/route-auth";

export const runtime = "nodejs";

interface UploadToken {
  uploadId: string;
  filename: string;
  mimeType: string;
  kind: AttachmentKind;
  bytes: number;
  expires: number;
}

/** Finishes an upload and returns a signed attachment reference to send with a chat message. */
export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) return context.error;

  const body = (await request.json().catch(() => null)) as { token?: string; partIds?: string[] } | null;
  const upload = unseal<UploadToken>(context.appUser.id, body?.token);
  if (!upload || upload.expires < Date.now()) return NextResponse.json({ error: "This upload expired. Try again." }, { status: 403 });
  const partIds = Array.isArray(body?.partIds) ? body.partIds.filter((id): id is string => typeof id === "string") : [];
  if (!partIds.length) return NextResponse.json({ error: "Nothing was uploaded." }, { status: 400 });

  try {
    const done = await completeUpload(upload.uploadId, partIds);
    if (!done.file?.id) throw new Error(`upload ${done.status}`);
    const record: AttachmentRecord = {
      fileId: done.file.id,
      filename: upload.filename,
      mimeType: upload.mimeType,
      bytes: upload.bytes,
      kind: upload.kind,
    };
    return NextResponse.json({ ...record, ref: seal(context.appUser.id, record) });
  } catch (error) {
    console.error("upload complete failed", error);
    return NextResponse.json({ error: "Couldn't finish the upload. Try again." }, { status: 502 });
  }
}
