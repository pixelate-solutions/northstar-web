import { NextResponse } from "next/server";

import { requireRouteTripContext } from "@/lib/route-auth";
import { getDashboardBundle } from "@/lib/server-data";
import { setActiveTrip } from "@/lib/trips";

/**
 * Full plan for the active trip: trip, days with stops and pins, packing, expenses, to-dos.
 * Pass ?tripId= to switch the active trip first (used by the iOS app's trip switcher).
 */
export async function GET(request: Request) {
  const requestedTripId = Number(new URL(request.url).searchParams.get("tripId"));
  let context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  if (Number.isInteger(requestedTripId) && requestedTripId > 0) {
    if (requestedTripId !== context.appUser.activeTripId) {
      const switched = await setActiveTrip(context.appUser.id, requestedTripId);
      if (!switched) {
        return NextResponse.json({ error: "Trip not found." }, { status: 404 });
      }
    }
    context = await requireRouteTripContext({ tripId: requestedTripId });
    if ("error" in context) {
      return context.error;
    }
    if (context.activeTrip.id !== requestedTripId) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
  }

  const bundle = await getDashboardBundle(context.activeTrip.id);
  if (!bundle) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  return NextResponse.json({ ...bundle, role: context.activeTripRole });
}
