import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { aiConversations, aiMessages } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";

export const runtime = "nodejs";

/** Opens a chat attachment for the person who sent it. Redirects to the stored copy. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string; index: string }> }
) {
  const context = await requireRouteTripContext();
  if ("error" in context) return context.error;

  const { messageId, index } = await params;
  const [row] = await context.db
    .select({ metadataJson: aiMessages.metadataJson })
    .from(aiMessages)
    .innerJoin(aiConversations, eq(aiConversations.id, aiMessages.conversationId))
    .where(and(eq(aiMessages.id, Number(messageId)), eq(aiConversations.userId, context.appUser.id)))
    .limit(1);

  let url: unknown;
  try {
    url = (JSON.parse(row?.metadataJson ?? "null")?.attachments as { blobUrl?: string }[] | undefined)?.[Number(index)]?.blobUrl;
  } catch {}
  if (typeof url !== "string" || !url.startsWith("https://")) {
    return NextResponse.json({ error: "This file can't be opened." }, { status: 404 });
  }
  const target = new URL(url);
  if (new URL(request.url).searchParams.get("download")) target.searchParams.set("download", "1");
  return NextResponse.redirect(target, { headers: { "Cache-Control": "private, max-age=300" } });
}
