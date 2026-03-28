import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { reminders } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { reminderSchema } from "@/lib/validation";

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

  const payload = reminderSchema.partial().parse(await request.json());
  const [updated] = await context.db
    .update(reminders)
    .set({
      ...payload,
      dueDate: payload.dueDate || null,
    })
    .where(eq(reminders.id, context.reminder.id))
    .returning();

  return NextResponse.json(updated);
}

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
