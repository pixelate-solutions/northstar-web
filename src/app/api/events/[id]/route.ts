import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { events } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { eventPatchSchema, parseJsonBody } from "@/lib/validation";

function revalidateAppPaths() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/calendar");
  revalidatePath("/app/days");
  revalidatePath("/app/days/[date]", "page");
}

async function getOwnedEvent(eventId: number) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context;
  }

  const event = await context.db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      day: true,
    },
  });

  if (!event || event.day.tripId !== context.activeTrip.id) {
    return {
      error: NextResponse.json({ error: "Event not found." }, { status: 404 }),
    };
  }

  return {
    ...context,
    event,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const eventId = Number(id);
  const context = await getOwnedEvent(eventId);
  if (!("event" in context)) {
    return context.error;
  }

  const parsed = await parseJsonBody(request, eventPatchSchema);
  if ("error" in parsed) return parsed.error;
  const payload = parsed.data;

  if (payload.dayId !== undefined && payload.dayId !== context.event.dayId) {
    const targetDay = await context.db.query.days.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, payload.dayId!), eq(table.tripId, context.activeTrip.id)),
    });
    if (!targetDay) {
      return NextResponse.json({ error: "Day not found for this trip." }, { status: 404 });
    }
  }

  const [updated] = await context.db
    .update(events)
    .set({ ...payload, updatedAt: new Date() })
    .where(eq(events.id, eventId))
    .returning();

  revalidateAppPaths();
  return NextResponse.json(updated);
}

export const PATCH = PUT;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const eventId = Number(id);
  const context = await getOwnedEvent(eventId);
  if (!("event" in context)) {
    return context.error;
  }

  await context.db.delete(events).where(eq(events.id, eventId));
  revalidateAppPaths();
  return NextResponse.json({ success: true });
}
