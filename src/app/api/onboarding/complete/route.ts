import { NextResponse } from "next/server";

import { requireRouteTripContext } from "@/lib/route-auth";
import { markOnboardingComplete } from "@/lib/trips";

export async function POST() {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  await markOnboardingComplete(context.appUser.id);
  return NextResponse.json({ success: true });
}
