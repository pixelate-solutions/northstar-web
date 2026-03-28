import { NextResponse } from "next/server";

import { getDaysOverview } from "@/lib/server-data";
import { requireRouteTripContext } from "@/lib/route-auth";
import { updateTripDates } from "@/lib/trips";

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

export async function GET() {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const data = await getDaysOverview(context.activeTrip.id);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
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

  await updateTripDates(context.activeTrip.id, payload.startDate, totalDays);
  const data = await getDaysOverview(context.activeTrip.id);
  return NextResponse.json(data);
}
