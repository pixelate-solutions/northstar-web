import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { RouteArt } from "@/components/brand/RouteArt";
import { Wordmark } from "@/components/brand/Logo";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/app");
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <nav className="flex items-center justify-between px-5 pt-5 sm:px-14 sm:pt-7">
        <Wordmark />
        <Link
          href="/sign-in"
          className="rounded-full border border-line px-4 py-2 text-[15px] font-semibold transition hover:bg-surface"
        >
          Sign in
        </Link>
      </nav>

      <section className="flex flex-1 flex-col gap-6 px-5 pb-6 pt-8 lg:flex-row lg:gap-14 lg:px-14 lg:pb-14 lg:pt-6">
        <div className="flex flex-col justify-end gap-8 lg:w-[520px] lg:shrink-0 lg:gap-10 lg:pb-6">
          <h1 className="text-[52px] font-extrabold leading-[52px] tracking-[-0.04em] sm:text-[72px] sm:leading-[72px] lg:text-[84px] lg:leading-[84px]">
            Every day of the trip, on one map.
          </h1>
          <Link
            href="/sign-up"
            className="hidden items-center gap-3 self-start rounded-full bg-lane px-7 py-[18px] text-[17px] font-bold transition hover:brightness-95 lg:inline-flex"
          >
            Get started
            <Arrow />
          </Link>
        </div>
        <div className="relative min-h-[340px] flex-1 overflow-hidden rounded-[20px] bg-land">
          <RouteArt className="absolute inset-0 h-full w-full" />
        </div>
        <Link
          href="/sign-up"
          className="flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-lane text-[17px] font-bold lg:hidden"
        >
          Get started
          <Arrow />
        </Link>
      </section>

      <footer className="flex justify-center gap-5 pb-5 text-[13px] font-medium text-muted lg:justify-end lg:px-14">
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/terms" className="hover:text-ink">Terms</Link>
      </footer>
    </main>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
