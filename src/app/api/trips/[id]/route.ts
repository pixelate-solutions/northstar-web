import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { trips } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth";
import { requireRouteTripContext } from "@/lib/route-auth";
import { deleteTripForUser } from "@/lib/trips";

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
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        name?: string;
        destination?: string | null;
        summary?: string | null;
        coverImageUrl?: string | null;
        startDate?: string | null;
        endDate?: string | null;
      }
    | null;

  if (context.activeTrip.id !== tripId) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (payload?.name !== undefined) {
    const nextName = payload.name.trim();
    if (!nextName) {
      return NextResponse.json({ error: "Trip name is required." }, { status: 400 });
    }
    if (nextName.length > 80) {
      return NextResponse.json(
        { error: "Trip name must be 80 characters or fewer." },
        { status: 400 }
      );
    }
    updates.name = nextName;
  }

  if (payload?.destination !== undefined) {
    updates.destination = payload.destination?.trim() || null;
  }

  if (payload?.summary !== undefined) {
    updates.summary = payload.summary?.trim() || null;
  }

  if (payload?.coverImageUrl !== undefined) {
    updates.coverImageUrl = payload.coverImageUrl?.trim() || null;
  }

  if (payload?.startDate !== undefined) {
    updates.startDate = payload.startDate || null;
  }

  if (payload?.endDate !== undefined) {
    updates.endDate = payload.endDate || null;
  }

  const [updatedTrip] = await context.db
    .update(trips)
    .set(updates)
    .where(eq(trips.id, tripId))
    .returning();

  revalidateAppPaths();
  return NextResponse.json(updatedTrip);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  const result = await deleteTripForUser(appUser.id, tripId);
  if (!result?.deletedTrip) {
    return NextResponse.json({ error: "Only the trip owner can delete this trip." }, { status: 403 });
  }

  revalidateAppPaths();
  return NextResponse.json({
    success: true,
    nextActiveTripId: result.nextActiveTripId,
  });
}
