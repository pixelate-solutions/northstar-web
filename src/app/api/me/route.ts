import { NextResponse } from "next/server";

import { requireRouteTripContext } from "@/lib/route-auth";

export async function GET() {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const { appUser, trips, activeTrip } = context;
  return NextResponse.json({
    user: {
      id: appUser.id,
      name: appUser.fullName ?? appUser.firstName ?? appUser.email ?? "Traveler",
      firstName: appUser.firstName,
      email: appUser.email,
    },
    activeTripId: activeTrip.id,
    trips: trips.map((trip) => ({
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      role: trip.accessRole,
    })),
  });
}
