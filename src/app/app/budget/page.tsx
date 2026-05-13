import { BudgetManager } from "@/components/budget/BudgetManager";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentTripContext } from "@/lib/auth";
import { getDaysOverview, getExpenses } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";

export const metadata = buildMetadata("Budget");
export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const context = await getCurrentTripContext();
  if (!context) {
    return null;
  }

  const trip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  if (!trip) {
    return null;
  }

  const [expenses, days] = await Promise.all([
    getExpenses(trip.id),
    getDaysOverview(trip.id),
  ]);
  const canEdit = (context.activeTripRole ?? trip.accessRole) !== "viewer";
  const plannedEventCost = days.reduce(
    (sum, day) =>
      sum + day.events.reduce((eventSum, event) => eventSum + Number(event.cost ?? 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Budget Tracker"
        description="Monitor booked vs. paid trip costs and keep an eye on category totals."
      />
      <BudgetManager
        initialExpenses={expenses}
        canEdit={canEdit}
        dayCount={days.length}
        plannedEventCost={plannedEventCost}
      />
    </div>
  );
}
