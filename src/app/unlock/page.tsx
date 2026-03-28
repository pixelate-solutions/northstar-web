import { redirect } from "next/navigation";

import { UnlockButton } from "@/components/shared/UnlockButton";
import { Button } from "@/components/ui/button";
import { getAuthenticatedClerkUserId, getCurrentAppUser, isClerkConfigured } from "@/lib/auth";
import { getStripeConfigurationError, isStripeConfigured } from "@/lib/billing";
import { product } from "@/lib/product";
import { buildAuthHref } from "@/lib/start";

export default async function UnlockPage() {
  if (!isClerkConfigured()) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <div className="w-full rounded-[2rem] border border-border/70 bg-card/90 p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-primary/80">Setup Required</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Add Clerk keys first</h1>
          <p className="mt-4 text-muted-foreground">
            Authentication must be configured before the paywall can run.
          </p>
        </div>
      </div>
    );
  }

  const clerkUserId = await getAuthenticatedClerkUserId();
  if (!clerkUserId) {
    redirect(buildAuthHref("/sign-up"));
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect(buildAuthHref("/sign-up"));
  }

  if (appUser.hasLifetimeAccess) {
    redirect("/app");
  }

  const stripeReady = isStripeConfigured();
  const stripeError = getStripeConfigurationError();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
      <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] bg-[linear-gradient(135deg,rgba(17,65,102,0.98),rgba(21,117,132,0.88))] p-10 text-white shadow-[0_30px_90px_rgba(17,46,72,0.18)]">
          <p className="text-xs uppercase tracking-[0.32em] text-white/70">Unlock Northstar</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Lifetime access to the core planning workspace.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/78">
            Pay once and keep access to trip planning, itinerary building, maps, exports, and
            reusable templates.
          </p>
          <div className="mt-8 grid gap-3">
            {[
              "Multiple private trips per account",
              "Structured day-by-day planning",
              "Budget, reminders, and packing tools",
              "Template-driven trip setup",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/65 bg-white/85 p-8 shadow-[0_30px_90px_rgba(17,46,72,0.10)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.32em] text-primary/80">Pricing</p>
          <h2 className="mt-4 text-5xl font-semibold tracking-tight text-slate-950">
            {product.priceLabel}
          </h2>
          <p className="mt-3 text-base leading-8 text-slate-600">
            One-time purchase. Lifetime access to the software. Optional AI features may be
            offered later as a separate upgrade.
          </p>

          <div className="mt-8">
            {stripeReady ? (
              <UnlockButton />
            ) : (
              <Button disabled className="h-12 rounded-2xl px-5">
                Stripe keys required
              </Button>
            )}
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {stripeReady
              ? "You will be redirected to Stripe Checkout."
              : stripeError ?? "Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID to enable checkout."}
          </p>
        </div>
      </div>
    </div>
  );
}
