import { NextResponse } from "next/server";

import { getAiConversation, listAiMessages, requireDb } from "@/lib/ai/db";
import { toMessagePayload } from "@/lib/ai/types";
import { requireRouteTripContext } from "@/lib/route-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const { conversationId } = await params;
  const db = requireDb();
  const conversation = await getAiConversation(
    db,
    context.appUser.id,
    context.activeTrip.id,
    Number(conversationId)
  );

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const messages = await listAiMessages(db, conversation.id);
  return NextResponse.json(messages.map(toMessagePayload));
}
