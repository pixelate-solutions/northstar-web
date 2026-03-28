import { NextResponse } from "next/server";

import { getAiConversation } from "@/lib/ai/db";
import { undoAiTurnForAssistantMessage } from "@/lib/ai/orchestrator";
import { toMessagePayload } from "@/lib/ai/types";
import { requireRouteTripContext } from "@/lib/route-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const { messageId } = await params;
  const assistantMessageId = Number(messageId);
  if (!Number.isFinite(assistantMessageId)) {
    return NextResponse.json({ error: "Invalid message id." }, { status: 400 });
  }

  const conversationIdHeader = _request.headers.get("x-ai-conversation-id");
  const conversationId = Number(conversationIdHeader);
  if (!Number.isFinite(conversationId)) {
    return NextResponse.json({ error: "Conversation id is required." }, { status: 400 });
  }

  const db = context.db;
  const conversation = await getAiConversation(
    db,
    context.appUser.id,
    context.activeTrip.id,
    conversationId
  );
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  try {
    const result = await undoAiTurnForAssistantMessage({
      appUser: context.appUser,
      activeTrip: context.activeTrip,
      conversationId: conversation.id,
      assistantMessageId,
    });

    return NextResponse.json({
      success: true,
      summary: result.summary,
      message: toMessagePayload(result.message),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to undo that AI response.",
      },
      { status: 400 }
    );
  }
}
