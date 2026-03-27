import { NextResponse } from "next/server";

import { requireRouteTripContext } from "@/lib/route-auth";
import { createTrip } from "@/lib/trips";

export async function POST(request: Request) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const payload = (await request.json()) as {
    name?: string;
    destination?: string;
    startDate?: string;
    totalDays?: number;
    importTemplate?: boolean;
  };

  const created = await createTrip({
    user: context.appUser,
    name: payload.name ?? "",
    destination: payload.destination,
    startDate: payload.startDate,
    totalDays: payload.totalDays,
    importTemplate: Boolean(payload.importTemplate),
  });

  if (!created) {
    return NextResponse.json({ error: "Unable to create trip." }, { status: 500 });
  }

  return NextResponse.json(created, { status: 201 });
}
