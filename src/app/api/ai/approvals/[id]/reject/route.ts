import { NextResponse } from "next/server";

import { createAiActionLog, getAiApproval, requireDb, resolveAiApproval } from "@/lib/ai/db";
import { requireRouteTripContext } from "@/lib/route-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const { id } = await params;
  const approvalId = Number(id);
  const db = requireDb();
  const approval = await getAiApproval(db, context.appUser.id, context.activeTrip.id, approvalId);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found." }, { status: 404 });
  }

  const updated = await resolveAiApproval(db, approval.id, "rejected");
  await createAiActionLog(db, {
    userId: context.appUser.id,
    tripId: context.activeTrip.id,
    conversationId: approval.conversationId ?? null,
    messageId: approval.messageId ?? null,
    actionType: "approval_rejected",
    summary: `Rejected ${approval.title}.`,
    details: { approvalId: approval.id, approvalType: approval.approvalType },
  });

  return NextResponse.json({
    approval: updated,
  });
}
