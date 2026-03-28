import { NextResponse } from "next/server";

import { buildGoogleConnectUrl, isGoogleConfigured } from "@/lib/ai/integrations/google";
import { requireRouteTripContext } from "@/lib/route-auth";

export async function GET(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google integration is not configured." },
      { status: 503 }
    );
  }

  const returnTo =
    new URL(request.url).searchParams.get("returnTo") || "/app";
  const url = buildGoogleConnectUrl({
    userId: context.appUser.id,
    tripId: context.activeTrip.id,
    returnTo,
  });

  return NextResponse.redirect(url);
}
