import { BudgetManager } from "@/components/budget/BudgetManager";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getExpenses } from "@/lib/server-data";

export const metadata = buildMetadata("Budget");
export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const expenses = await getExpenses();

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
