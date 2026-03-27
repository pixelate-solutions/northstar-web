import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ArrowRight, CalendarDays, CheckCircle2, LayoutDashboard, Map, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentAppUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/metadata";
import {
  landingFaqs,
  landingFeatureHighlights,
  landingWorkflow,
  product,
} from "@/lib/product";

export const metadata = buildMetadata();

export default async function LandingPage() {
  const appUser = await getCurrentAppUser();
  const clerkReady = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const primaryHref = appUser ? (appUser.hasLifetimeAccess ? "/app" : "/unlock") : "/sign-up";
  const primaryLabel = appUser
    ? appUser.hasLifetimeAccess
      ? "Open Northstar"
      : "Unlock Access"
    : "Start Planning";

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(circle_at_14%_12%,rgba(25,84,129,0.18),transparent_26%),radial-gradient(circle_at_82%_10%,rgba(30,155,149,0.18),transparent_24%),radial-gradient(circle_at_72%_48%,rgba(193,231,227,0.30),transparent_28%),linear-gradient(180deg,#f8fbfc_0%,#f5faf9_42%,#fbfdfd_100%)]" />
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-full border border-white/60 bg-white/70 px-4 py-3 shadow-[0_24px_60px_rgba(17,46,72,0.08)] backdrop-blur-xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.34em] text-primary/80">{product.name}</p>
            <p className="text-sm text-muted-foreground">Travel planning, structured.</p>
          </div>
          <div className="flex items-center gap-2">
            {appUser && clerkReady ? (
              <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-2 py-1 shadow-[0_12px_28px_rgba(17,46,72,0.06)]">
                <Link href={primaryHref}>
                  <Button variant="ghost" className="rounded-full">
                    {appUser.hasLifetimeAccess ? "Workspace" : "Unlock"}
                  </Button>
                </Link>
                <UserButton />
              </div>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" className="rounded-full">Sign In</Button>
                </Link>
                <Link href={primaryHref}>
                  <Button className="rounded-full px-5">
                    {primaryLabel}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="grid gap-12 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-24">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="inline-flex rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.34em] text-primary/80">
                Modern Trip Operating System
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Plan trips without the chaos.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Turn flights, hotels, ideas, notes, reminders, and route stops into one
                structured itinerary that stays clear from first draft to departure day.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href={primaryHref}>
                <Button className="h-12 rounded-full px-6 text-base">
                  {primaryLabel}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href={appUser ? primaryHref : "/sign-in"}>
                <Button variant="outline" className="h-12 rounded-full px-6 text-base">
                  {appUser ? "Open Account" : "View Account Flow"}
                </Button>
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Itinerary builder",
                "Trip templates",
                "Lifetime access",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/70 bg-white/75 px-4 py-4 text-sm text-slate-700 shadow-[0_20px_45px_rgba(17,46,72,0.06)] backdrop-blur-xl"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-x-10 top-8 -z-10 h-64 rounded-full bg-[radial-gradient(circle,rgba(27,154,150,0.18),rgba(27,154,150,0))] blur-3xl" />
            <div className="rounded-[2rem] border border-white/65 bg-white/80 p-5 shadow-[0_34px_90px_rgba(17,46,72,0.12)] backdrop-blur-xl">
              <div className="rounded-[1.6rem] border border-slate-200/80 bg-slate-950 px-5 py-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">
                      Northstar Workspace
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">California Coast Escape</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                    7 days
                  </span>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Activities</p>
                    <p className="mt-3 text-3xl font-semibold">24</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Stops</p>
                    <p className="mt-3 text-3xl font-semibold">11</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Booked</p>
                    <p className="mt-3 text-3xl font-semibold">$1.9k</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ["Day 1", "Arrive, rental car, downtown dinner"],
                    ["Day 2", "Coastal drive, lunch stop, sunset overlook"],
                    ["Day 3", "Hotel check-in, museum tickets, evening notes"],
                  ].map(([label, text]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-sm text-white/60">{text}</p>
                      </div>
                      <CheckCircle2 className="size-4 text-cyan-300" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/60 bg-white/75 p-8 shadow-[0_28px_70px_rgba(17,46,72,0.08)]">
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Problem</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Travel planning usually lives in six different places.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Notes, screenshots, open tabs, booking emails, maps, and reminders rarely stay
              in sync. Northstar gives you one structured dashboard so the trip stays readable.
            </p>
          </div>
          <div className="rounded-[2rem] border border-primary/10 bg-[linear-gradient(135deg,rgba(17,65,102,0.96),rgba(21,117,132,0.84))] p-8 text-white shadow-[0_28px_70px_rgba(17,46,72,0.14)]">
            <p className="text-xs uppercase tracking-[0.3em] text-white/65">Solution</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              One planning workspace from rough idea to final itinerary.
            </h2>
            <p className="mt-4 text-base leading-8 text-white/78">
              Build day-by-day plans, organize activities, track costs, keep reminders visible,
              and move faster without rebuilding the same trip structure every time.
            </p>
          </div>
        </section>

        <section className="mt-20">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Features</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Built for organized travelers, not travel content browsing.
            </h2>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {landingFeatureHighlights.map((feature, index) => (
              <div
                key={feature.title}
                className="rounded-[1.8rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_50px_rgba(17,46,72,0.06)]"
              >
                <p className="text-sm text-primary/75">0{index + 1}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {feature.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/60 bg-white/75 p-8 shadow-[0_24px_60px_rgba(17,46,72,0.06)]">
            <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Workflow</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              A simple planning loop that stays structured.
            </h2>
            <div className="mt-6 space-y-3">
              {landingWorkflow.map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-4"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="text-base font-medium text-slate-900">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              {
                icon: LayoutDashboard,
                title: "Trip dashboard",
                body: "Keep the itinerary, reminders, and progress visible in one place.",
              },
              {
                icon: CalendarDays,
                title: "Day planner",
                body: "Break every trip into clear day blocks with notes and logistics.",
              },
              {
                icon: Map,
                title: "Route context",
                body: "See locations and movement across the full trip without losing detail.",
              },
              {
                icon: Wallet,
                title: "Budget awareness",
                body: "Track booked and paid costs next to the itinerary they affect.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[1.8rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_50px_rgba(17,46,72,0.06)]"
              >
                <item.icon className="size-6 text-primary" />
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[2.2rem] border border-primary/10 bg-white/78 p-8 shadow-[0_28px_70px_rgba(17,46,72,0.08)] lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Pricing</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                {product.priceLabel}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
                {product.priceDescription} Future AI planning features can be added later as a
                separate subscription.
              </p>
            </div>
            <Link href={appUser ? (appUser.hasLifetimeAccess ? "/app" : "/unlock") : "/sign-up"}>
              <Button className="h-12 rounded-full px-6">
                {appUser?.hasLifetimeAccess ? "Open your workspace" : "Get lifetime access"}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <p className="text-xs uppercase tracking-[0.3em] text-primary/80">FAQ</p>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {landingFaqs.map((item) => (
              <div
                key={item.question}
                className="rounded-[1.7rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_50px_rgba(17,46,72,0.06)]"
              >
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                  {item.question}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-[2.2rem] border border-primary/10 bg-[linear-gradient(135deg,rgba(17,65,102,0.98),rgba(21,117,132,0.88))] p-8 text-white shadow-[0_34px_90px_rgba(17,46,72,0.16)] lg:flex lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-white/65">Start planning</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight">
              Build your next trip in one structured workspace.
            </h2>
            <p className="mt-4 text-base leading-8 text-white/78">
              Sign up, unlock lifetime access, and start with a blank trip or a ready-made
              template.
            </p>
          </div>
          <div className="mt-6 lg:mt-0">
            <Link href={primaryHref}>
              <Button className="h-12 rounded-full bg-white px-6 text-slate-950 hover:bg-white/90">
                {primaryLabel}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
