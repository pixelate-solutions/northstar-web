import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { reminders } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { parseJsonBody, reminderPatchSchema } from "@/lib/validation";

async function getOwnedReminder(reminderId: number) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context;
  }

  const reminder = await context.db.query.reminders.findFirst({
    where: eq(reminders.id, reminderId),
  });

  if (!reminder || reminder.tripId !== context.activeTrip.id) {
    return {
      error: NextResponse.json({ error: "Reminder not found." }, { status: 404 }),
    };
  }

  return {
    ...context,
    reminder,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getOwnedReminder(Number(id));
  if (!("reminder" in context)) {
    return context.error;
  }

  const parsed = await parseJsonBody(request, reminderPatchSchema);
  if ("error" in parsed) return parsed.error;
  if (!Object.keys(parsed.data).length) return NextResponse.json(context.reminder);

  const [updated] = await context.db
    .update(reminders)
    .set(parsed.data)
    .where(eq(reminders.id, context.reminder.id))
    .returning();

  return NextResponse.json(updated);
}

export const PATCH = PUT;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getOwnedReminder(Number(id));
  if (!("reminder" in context)) {
    return context.error;
  }

  await context.db.delete(reminders).where(eq(reminders.id, context.reminder.id));
  return NextResponse.json({ success: true });
}
