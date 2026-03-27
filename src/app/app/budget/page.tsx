import { BudgetManager } from "@/components/budget/BudgetManager";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentAppUser } from "@/lib/auth";
import { getExpenses } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";

export const metadata = buildMetadata("Budget");
export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return null;
  }

  const trip = await ensureStarterTrip(appUser);
  if (!trip) {
    return null;
  }

  const expenses = await getExpenses(trip.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Budget Tracker"
        description="Monitor booked vs. paid trip costs and keep an eye on category totals."
      />
      <BudgetManager initialExpenses={expenses} />
    </div>
  );
}
