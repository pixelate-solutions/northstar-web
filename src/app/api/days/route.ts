import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { days } from "@/db/schema";
import { getDaysOverview } from "@/lib/server-data";

export async function GET() {
  const data = await getDaysOverview();
  return NextResponse.json(data);
}

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function buildSequentialDates(startDate: string, totalDays: number) {
  const start = new Date(`${startDate}T12:00:00`);
  return Array.from({ length: totalDays }, (_, index) =>
    format(addDays(start, index), "yyyy-MM-dd")
  );
}

function buildTempDate(index: number) {
  return format(addDays(new Date("2100-01-01T12:00:00"), index), "yyyy-MM-dd");
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before trip days can be configured." },
      { status: 503 }
    );
  }

  const payload = (await request.json()) as {
    startDate?: string;
    totalDays?: number;
  };

  if (!payload.startDate || !isValidDateInput(payload.startDate)) {
    return NextResponse.json(
      { error: "A valid trip start date is required." },
      { status: 400 }
    );
  }

  const totalDays = Number(payload.totalDays);
  if (!Number.isInteger(totalDays) || totalDays < 1 || totalDays > 60) {
    return NextResponse.json(
      { error: "Trip length must be between 1 and 60 days." },
      { status: 400 }
    );
  }

  const existingDays = await db.select().from(days).orderBy(asc(days.date));
  const targetDates = buildSequentialDates(payload.startDate, totalDays);

  await db.transaction(async (tx) => {
    for (const [index, day] of existingDays.entries()) {
      await tx
        .update(days)
        .set({ date: buildTempDate(index) })
        .where(eq(days.id, day.id));
    }

    for (const [index, day] of existingDays.slice(0, totalDays).entries()) {
      await tx
        .update(days)
        .set({
          date: targetDates[index],
          dayNumber: index + 1,
        })
        .where(eq(days.id, day.id));
    }

    for (const day of existingDays.slice(totalDays)) {
      await tx.delete(days).where(eq(days.id, day.id));
    }

    for (let index = existingDays.length; index < totalDays; index += 1) {
      await tx.insert(days).values({
        date: targetDates[index],
        dayNumber: index + 1,
        title: `Day ${index + 1}`,
        location: "",
        sleepLocation: null,
        driveInfo: null,
        notes: null,
        coverImageUrl: null,
      });
    }
  });

  const data = await getDaysOverview();
  return NextResponse.json(data);
}
