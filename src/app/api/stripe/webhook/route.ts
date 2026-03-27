import { NextResponse } from "next/server";

import { getStripe, grantLifetimeAccess } from "@/lib/billing";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const appUserId = Number(session.metadata?.appUserId ?? session.client_reference_id);

      if (Number.isInteger(appUserId) && appUserId > 0) {
        await grantLifetimeAccess(appUserId, {
          checkoutSessionId: session.id,
          customerId: typeof session.customer === "string" ? session.customer : null,
          paymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
