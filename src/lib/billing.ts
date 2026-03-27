import "server-only";

import Stripe from "stripe";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { appUsers, type AppUser } from "@/db/schema";
import { product } from "@/lib/product";

function isValidStripeSecretKey(value: string | undefined) {
  const key = value?.trim();
  return Boolean(key && (key.startsWith("sk_test_") || key.startsWith("sk_live_")));
}

export function isStripeConfigured() {
  return Boolean(
    isValidStripeSecretKey(process.env.STRIPE_SECRET_KEY) &&
      process.env.STRIPE_PRICE_ID?.trim()
  );
}

export function getStripeConfigurationError() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_PRICE_ID?.trim();

  if (!secretKey) {
    return "Add STRIPE_SECRET_KEY before enabling checkout.";
  }

  if (!isValidStripeSecretKey(secretKey)) {
    return "STRIPE_SECRET_KEY must be a Stripe secret key starting with sk_test_ or sk_live_.";
  }

  if (!priceId) {
    return "Add STRIPE_PRICE_ID before enabling checkout.";
  }

  return null;
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!isValidStripeSecretKey(secretKey)) {
    return null;
  }

  return new Stripe(secretKey as string);
}

export function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

export async function createCheckoutSession(appUser: AppUser) {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID?.trim();

  if (!stripe || !priceId) {
    throw new Error(getStripeConfigurationError() ?? "Stripe is not configured.");
  }

  const baseUrl = getBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/unlock/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/unlock`,
    customer_email: appUser.email ?? undefined,
    client_reference_id: String(appUser.id),
    metadata: {
      appUserId: String(appUser.id),
      productName: product.stripeProductName,
    },
  });

  const db = getDb();
  if (db) {
    await db
      .update(appUsers)
      .set({
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, appUser.id));
  }

  return session;
}

export async function grantLifetimeAccess(appUserId: number, details?: {
  checkoutSessionId?: string | null;
  customerId?: string | null;
  paymentIntentId?: string | null;
}) {
  const db = getDb();
  if (!db) {
    return null;
  }

  const [updated] = await db
    .update(appUsers)
    .set({
      hasLifetimeAccess: true,
      stripeCheckoutSessionId: details?.checkoutSessionId ?? undefined,
      stripeCustomerId: details?.customerId ?? undefined,
      stripePaymentIntentId: details?.paymentIntentId ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, appUserId))
    .returning();

  return updated ?? null;
}

export async function syncLifetimeAccessFromSessionId(sessionId: string) {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(getStripeConfigurationError() ?? "Stripe is not configured.");
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const appUserId = Number(session.metadata?.appUserId ?? session.client_reference_id);

  if (!Number.isInteger(appUserId) || appUserId <= 0) {
    return null;
  }

  if (session.payment_status !== "paid") {
    return null;
  }

  return grantLifetimeAccess(appUserId, {
    checkoutSessionId: session.id,
    customerId: typeof session.customer === "string" ? session.customer : null,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });
}
