import { NextResponse } from "next/server";

import { addUploadPart, storePartCopy, UPLOAD_PART_BYTES, unseal } from "@/lib/ai/uploads";
import { requireRouteTripContext } from "@/lib/route-auth";

export const runtime = "nodejs";

interface UploadToken {
  uploadId: string;
  expires: number;
}

/** Forwards one part (raw body, up to 4 MB) of an upload started by this user. */
export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) return context.error;

  const upload = unseal<UploadToken>(context.appUser.id, request.headers.get("x-upload-token"));
  if (!upload || upload.expires < Date.now()) return NextResponse.json({ error: "This upload expired. Try again." }, { status: 403 });

  const data = await request.blob();
  if (!data.size || data.size > UPLOAD_PART_BYTES) return NextResponse.json({ error: "Invalid upload part." }, { status: 400 });

  try {
    const part = await addUploadPart(upload.uploadId, data);
    await storePartCopy(upload.uploadId, part.id, data);
    return NextResponse.json({ partId: part.id });
  } catch (error) {
    console.error("upload part failed", error);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 502 });
  }
}
