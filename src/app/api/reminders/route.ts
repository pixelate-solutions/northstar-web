import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { reminders } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { reminderSchema, parseJsonBody } from "@/lib/validation";

export async function GET() {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const data = await context.db
    .select()
    .from(reminders)
    .where(eq(reminders.tripId, context.activeTrip.id))
    .orderBy(asc(reminders.dueDate));

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const parsed = await parseJsonBody(request, reminderSchema);
  if ("error" in parsed) return parsed.error;
  const payload = parsed.data;
  const [created] = await context.db
    .insert(reminders)
    .values({
      ...payload,
      tripId: context.activeTrip.id,
      dueDate: payload.dueDate || null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
