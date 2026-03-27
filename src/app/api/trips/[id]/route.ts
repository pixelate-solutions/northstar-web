import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { trips } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";

function revalidateAppPaths() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/calendar");
  revalidatePath("/app/days");
  revalidatePath("/app/days/[date]", "page");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as { name?: string } | null;
  const nextName = payload?.name?.trim() ?? "";

  if (!nextName) {
    return NextResponse.json({ error: "Trip name is required." }, { status: 400 });
  }

  if (nextName.length > 80) {
    return NextResponse.json(
      { error: "Trip name must be 80 characters or fewer." },
      { status: 400 }
    );
  }

  const ownedTrip = await context.db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, context.appUser.id)),
  });

  if (!ownedTrip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const [updatedTrip] = await context.db
    .update(trips)
    .set({
      name: nextName,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId))
    .returning();

  revalidateAppPaths();
  return NextResponse.json(updatedTrip);
}
