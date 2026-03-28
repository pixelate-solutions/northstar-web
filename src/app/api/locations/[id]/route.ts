import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { locations } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { locationSchema } from "@/lib/validation";

function revalidateLocationViews() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/calendar");
  revalidatePath("/app/days");
  revalidatePath("/app/days/[date]", "page");
}

async function getOwnedLocation(locationId: number) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context;
  }

  const location = await context.db.query.locations.findFirst({
    where: eq(locations.id, locationId),
    with: {
      day: true,
    },
  });

  if (!location || location.day.tripId !== context.activeTrip.id) {
    return {
      error: NextResponse.json({ error: "Location not found." }, { status: 404 }),
    };
  }

  return {
    ...context,
    location,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getOwnedLocation(Number(id));
  if (!("location" in context)) {
    return context.error;
  }

  const payload = locationSchema.partial().parse(await request.json());
  const nextDayId =
    payload.dayId === undefined ? context.location.dayId : Number(payload.dayId);

  if (nextDayId !== context.location.dayId) {
    const ownedDay = await context.db.query.days.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, nextDayId), eq(table.tripId, context.activeTrip.id)),
    });

    if (!ownedDay) {
      return NextResponse.json({ error: "Target day not found." }, { status: 404 });
    }
  }

  const [updated] = await context.db
    .update(locations)
    .set({
      ...(payload.dayId !== undefined ? { dayId: nextDayId } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.lat !== undefined ? { lat: String(payload.lat) } : {}),
      ...(payload.lng !== undefined ? { lng: String(payload.lng) } : {}),
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.description !== undefined ? { description: payload.description || null } : {}),
      ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl || null } : {}),
      ...(payload.tip !== undefined ? { tip: payload.tip || null } : {}),
      ...(payload.googleMapsUrl !== undefined
        ? { googleMapsUrl: payload.googleMapsUrl || null }
        : {}),
    })
    .where(eq(locations.id, context.location.id))
    .returning();

  revalidateLocationViews();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getOwnedLocation(Number(id));
  if (!("location" in context)) {
    return context.error;
  }

  await context.db.delete(locations).where(eq(locations.id, context.location.id));
  revalidateLocationViews();
  return NextResponse.json({ success: true });
}
