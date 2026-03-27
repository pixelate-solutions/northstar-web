import { NextResponse } from "next/server";

import { requireRouteTripContext } from "@/lib/route-auth";
import { setActiveTrip } from "@/lib/trips";

export async function POST(request: Request) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const payload = (await request.json()) as { tripId?: number };
  const tripId = Number(payload.tripId);

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: "A valid tripId is required." }, { status: 400 });
  }

  const updatedUser = await setActiveTrip(context.appUser.id, tripId);
  if (!updatedUser) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
