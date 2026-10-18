"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { AskPanel } from "@/components/ask/AskPanel";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { Sidebar } from "@/components/shell/Sidebar";
import { useTrip } from "@/components/trip/TripProvider";
import { useIsDesktop } from "@/hooks/useMediaQuery";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ask, openAsk } = useTrip();
  const router = useRouter();

  // /app?draft=... (from New trip) opens Ask and sends the request once.
  useEffect(() => {
    const draft = new URLSearchParams(window.location.search).get("draft");
    if (!draft) return;
    openAsk(draft, true);
    router.replace(pathname);
  }, [openAsk, router, pathname]);
  const isDesktop = useIsDesktop();
  const onPlan = pathname === "/app" || pathname.startsWith("/app/days");

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-white">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
        {/* The Plan view hosts Ask in place of its map on desktop; other pages get a right-hand panel. */}
        {ask.open && isDesktop && !onPlan ? (
          <div className="absolute inset-y-0 right-0 z-[900] flex w-[560px] border-l border-line bg-white shadow-pop">
            <AskPanel />
          </div>
        ) : null}
      </main>
      {ask.open && !isDesktop ? (
        <div className="fixed inset-0 z-[1000] flex bg-white">
          <AskPanel />
        </div>
      ) : null}
      <MobileTabBar />
    </div>
  );
}
