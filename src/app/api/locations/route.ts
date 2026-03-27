import { NextResponse } from "next/server";

import { asc, eq, inArray } from "drizzle-orm";

import { days, locations } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";

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
