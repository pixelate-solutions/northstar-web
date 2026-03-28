import { NextResponse } from "next/server";

import { syncGoogleReservations } from "@/lib/ai/integrations/google";
import { requireRouteTripContext } from "@/lib/route-auth";

export async function POST() {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const result = await syncGoogleReservations({
    userId: context.appUser.id,
    tripId: context.activeTrip.id,
  });

  return NextResponse.json({
    importedCount: result.importedCount,
    reservations: result.reservations,
  });
}
