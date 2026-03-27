import { NextResponse } from "next/server";

import {
  createCheckoutSession,
  getStripeConfigurationError,
  isStripeConfigured,
} from "@/lib/billing";
import { requireRouteTripContext } from "@/lib/route-auth";

export async function POST() {
  const context = await requireRouteTripContext({ requirePaid: false });
  if ("error" in context) {
    return context.error;
  }

  if (context.appUser.hasLifetimeAccess) {
    return NextResponse.json({ error: "Account is already unlocked." }, { status: 400 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: getStripeConfigurationError() ?? "Stripe is not configured yet." },
      { status: 503 }
    );
  }

  try {
    const session = await createCheckoutSession(context.appUser);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start Stripe checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
