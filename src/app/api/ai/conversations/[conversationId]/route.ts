import { NextResponse } from "next/server";

import { createAiActionLog, deleteAiConversation, requireDb } from "@/lib/ai/db";
import { requireRouteTripContext } from "@/lib/route-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const { conversationId } = await params;
  const conversationIdNumber = Number(conversationId);
  if (!Number.isFinite(conversationIdNumber)) {
    return NextResponse.json({ error: "Invalid conversation id." }, { status: 400 });
  }

  const db = requireDb();
  const deletedConversation = await deleteAiConversation(
    db,
    context.appUser.id,
    context.activeTrip.id,
    conversationIdNumber
  );

  if (!deletedConversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  await createAiActionLog(db, {
    userId: context.appUser.id,
    tripId: context.activeTrip.id,
    conversationId: deletedConversation.id,
    actionType: "delete_ai_conversation",
    summary: `Deleted AI conversation "${deletedConversation.title}".`,
    details: {
      conversationId: deletedConversation.id,
      title: deletedConversation.title,
    },
  });

  return NextResponse.json({ success: true });
}
