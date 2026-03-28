import { revalidatePath } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { days, events } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { eventSchema } from "@/lib/validation";

function revalidateAppPaths() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/calendar");
  revalidatePath("/app/days");
  revalidatePath("/app/days/[date]", "page");
}

export async function GET(request: Request) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const dayId = Number(new URL(request.url).searchParams.get("dayId"));
  const tripDays = await context.db.query.days.findMany({
    where: eq(days.tripId, context.activeTrip.id),
    columns: { id: true },
  });
  const allowedDayIds = new Set(tripDays.map((day) => day.id));

  if (!allowedDayIds.size) {
    return NextResponse.json([]);
  }

  const data =
    Number.isFinite(dayId) && allowedDayIds.has(dayId)
      ? await context.db
          .select()
          .from(events)
          .where(eq(events.dayId, dayId))
          .orderBy(asc(events.sortOrder))
      : await context.db
          .select()
          .from(events)
          .where(inArray(events.dayId, [...allowedDayIds]))
          .orderBy(asc(events.dayId), asc(events.sortOrder));

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const payload = eventSchema.parse(await request.json());
  const ownedDay = await context.db.query.days.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, payload.dayId), eq(table.tripId, context.activeTrip.id)),
  });

  if (!ownedDay) {
    return NextResponse.json({ error: "Day not found for this trip." }, { status: 404 });
  }

  const [created] = await context.db
    .insert(events)
    .values({
      ...payload,
      cost: payload.cost === null ? null : String(payload.cost),
      lat: payload.lat === null ? null : String(payload.lat),
      lng: payload.lng === null ? null : String(payload.lng),
    })
    .returning();

  revalidateAppPaths();
  return NextResponse.json(created, { status: 201 });
}
