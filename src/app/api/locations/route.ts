import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { asc, eq, inArray } from "drizzle-orm";

import { days, locations } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { locationSchema } from "@/lib/validation";

function revalidateLocationViews() {
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

  if (Number.isFinite(dayId)) {
    const day = await context.db.query.days.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, dayId), eq(table.tripId, context.activeTrip.id)),
    });

    if (!day) {
      return NextResponse.json([]);
    }

    const data = await context.db
      .select()
      .from(locations)
      .where(eq(locations.dayId, dayId))
      .orderBy(asc(locations.name));

    return NextResponse.json(data);
  }

  const tripDays = await context.db.query.days.findMany({
    where: eq(days.tripId, context.activeTrip.id),
    columns: { id: true },
  });

  const data = tripDays.length
    ? await context.db
        .select()
        .from(locations)
        .where(inArray(locations.dayId, tripDays.map((day) => day.id)))
        .orderBy(asc(locations.dayId), asc(locations.name))
    : [];

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const payload = locationSchema.parse(await request.json());
  const ownedDay = await context.db.query.days.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, payload.dayId), eq(table.tripId, context.activeTrip.id)),
  });

  if (!ownedDay) {
    return NextResponse.json({ error: "Day not found for this trip." }, { status: 404 });
  }

  const [created] = await context.db
    .insert(locations)
    .values({
      ...payload,
      description: payload.description || null,
      imageUrl: payload.imageUrl || null,
      tip: payload.tip || null,
      googleMapsUrl: payload.googleMapsUrl || null,
    })
    .returning();

  revalidateLocationViews();
  return NextResponse.json(created, { status: 201 });
}
