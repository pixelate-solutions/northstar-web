import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { days } from "@/db/schema";
import { getDayByDate } from "@/lib/server-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const day = await getDayByDate(date);

  if (!day) {
    return NextResponse.json({ error: "Day not found." }, { status: 404 });
  }

  return NextResponse.json(day);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before days can be updated." },
      { status: 503 }
    );
  }

  const payload = (await request.json()) as { notes?: string };
  const { date } = await params;
  const [updated] = await db
    .update(days)
    .set({ notes: payload.notes ?? null })
    .where(eq(days.date, date))
    .returning();

  return NextResponse.json(updated);
}
