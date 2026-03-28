import { NextResponse } from "next/server";

import { createAiConversation, listAiConversations, requireDb } from "@/lib/ai/db";
import { toConversationSummary } from "@/lib/ai/types";
import { requireRouteTripContext } from "@/lib/route-auth";

export async function GET() {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const db = requireDb();
  const conversations = await listAiConversations(
    db,
    context.appUser.id,
    context.activeTrip.id
  );

  return NextResponse.json(conversations.map(toConversationSummary));
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const payload = (await request.json().catch(() => null)) as { title?: string } | null;
  const db = requireDb();
  const conversation = await createAiConversation(
    db,
    context.appUser.id,
    context.activeTrip.id,
    payload?.title?.trim() || "New conversation"
  );

  return NextResponse.json(toConversationSummary(conversation), { status: 201 });
}
