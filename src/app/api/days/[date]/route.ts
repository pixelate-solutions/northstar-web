import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { days, type NewDay } from "@/db/schema";
import { requireOwnedDay, requireRouteTripContext } from "@/lib/route-auth";
import { getDayByDate } from "@/lib/server-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const { date } = await params;
  const day = await getDayByDate(context.activeTrip.id, date);

  if (!day) {
    return NextResponse.json({ error: "Day not found." }, { status: 404 });
  }

  return NextResponse.json(day);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const context = await requireOwnedDay(date);
  if (!("day" in context)) {
    return context.error;
  }

  const payload = (await request.json()) as {
    date?: string;
    dayNumber?: number;
    title?: string;
    location?: string;
    sleepLocation?: string | null;
    driveInfo?: string | null;
    notes?: string | null;
    coverImageUrl?: string | null;
  };

  const updates: Partial<NewDay> = {};

  if (payload.date !== undefined) {
    updates.date = payload.date;
  }
  if (payload.dayNumber !== undefined) {
    updates.dayNumber = payload.dayNumber;
  }
  if (payload.title !== undefined) {
    updates.title = payload.title.trim() || "Untitled Day";
  }
  if (payload.location !== undefined) {
    updates.location = payload.location.trim();
  }
  if (payload.sleepLocation !== undefined) {
    updates.sleepLocation = payload.sleepLocation?.trim() || null;
  }
  if (payload.driveInfo !== undefined) {
    updates.driveInfo = payload.driveInfo?.trim() || null;
  }
  if (payload.notes !== undefined) {
    updates.notes = payload.notes?.trim() || null;
  }
  if (payload.coverImageUrl !== undefined) {
    updates.coverImageUrl = payload.coverImageUrl?.trim() || null;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json(context.day);
  }

  try {
    const [updated] = await context.db
      .update(days)
      .set(updates)
      .where(and(eq(days.id, context.day.id), eq(days.tripId, context.activeTrip.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Day not found." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Unable to update this day. Check that the date is unique for this trip." },
      { status: 409 }
    );
  }
}
