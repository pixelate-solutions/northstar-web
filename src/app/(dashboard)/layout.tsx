import { differenceInCalendarDays } from "date-fns";

import { MobileHeader } from "@/components/nav/MobileHeader";
import { Sidebar } from "@/components/nav/Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getDashboardBundle } from "@/lib/server-data";
import { TRIP_END, TRIP_START } from "@/lib/trip-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bundle = await getDashboardBundle();
  const now = new Date();

  let countdownLabel = `${differenceInCalendarDays(TRIP_START, now)} days until departure`;
  if (now >= TRIP_START && now <= TRIP_END) {
    countdownLabel = `Day ${differenceInCalendarDays(now, TRIP_START) + 1} of 11`;
  } else if (now > TRIP_END) {
    countdownLabel = "Trip complete";
  }

  const totalBooked = bundle.expenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );
  const packingPercent = bundle.packingItems.length
    ? Math.round(
        (bundle.packingItems.filter((item) => Boolean(item.isPacked)).length /
          bundle.packingItems.length) *
          100
      )
    : 0;

  return (
    <SidebarProvider>
      <div className="relative isolate min-h-screen bg-transparent text-foreground">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[44rem] bg-[radial-gradient(circle_at_top_left,rgba(238,195,154,0.26),transparent_26%),radial-gradient(circle_at_22%_8%,rgba(177,209,223,0.24),transparent_22%),radial-gradient(circle_at_top_right,rgba(225,190,140,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(250,246,239,0.76)_52%,rgba(255,252,247,0.7)_100%)] [mask-image:linear-gradient(to_bottom,black_0%,black_74%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_74%,transparent_100%)]" />
        <MobileHeader countdownLabel={countdownLabel} />
        <div className="mx-auto flex min-h-screen max-w-[1600px] lg:my-5 lg:min-h-[calc(100vh-2.5rem)] lg:max-w-[calc(100%-2.5rem)]">
          <Sidebar
            packingPercent={packingPercent}
            totalBooked={totalBooked}
            countdownLabel={countdownLabel}
          />
          <div className="min-w-0 flex-1 lg:rounded-[2.75rem] lg:border lg:border-white/40 lg:bg-white/18 lg:p-2 lg:shadow-[0_32px_110px_rgba(118,123,184,0.18),inset_0_1px_0_rgba(255,255,255,0.65)] lg:backdrop-blur-2xl">
            <main className="min-w-0 [overflow-x:clip] px-4 pb-8 pt-16 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
