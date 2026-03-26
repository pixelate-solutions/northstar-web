import { differenceInCalendarDays } from "date-fns";

import { MobileHeader } from "@/components/nav/MobileHeader";
import { Sidebar } from "@/components/nav/Sidebar";
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

  const unpackedCount = bundle.packingItems.filter((item) => !Boolean(item.isPacked)).length;
  const overdueCount = bundle.reminders.filter(
    (item) =>
      Boolean(item.dueDate) &&
      !Boolean(item.isDone) &&
      new Date(`${item.dueDate}T00:00:00`) < new Date()
  ).length;
  const unpaidCount = bundle.expenses.filter((item) => !Boolean(item.isPaid)).length;
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

  const totalBadge = unpackedCount + overdueCount + unpaidCount;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.20),transparent_45%),radial-gradient(circle_at_top_right,rgba(234,88,12,0.12),transparent_35%),linear-gradient(180deg,#fffaf3_0%,#f8f3ea_72%)]" />
      <MobileHeader countdownLabel={countdownLabel} totalBadge={totalBadge} />
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <Sidebar
          packingPercent={packingPercent}
          totalBooked={totalBooked}
          countdownLabel={countdownLabel}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 pb-8 pt-16 sm:px-6 lg:px-10 lg:pb-8 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
