import { PackingManager } from "@/components/packing/PackingManager";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentTripContext } from "@/lib/auth";
import { getDaysOverview, getPackingItems } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";

export const metadata = buildMetadata("Packing");
export const dynamic = "force-dynamic";

export default async function PackingPage() {
  const context = await getCurrentTripContext();
  if (!context) {
    return null;
  }

  const trip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  if (!trip) {
    return null;
  }

  const [days, items] = await Promise.all([
    getDaysOverview(trip.id),
    getPackingItems(trip.id),
  ]);
  const canEdit = (context.activeTripRole ?? trip.accessRole) !== "viewer";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Checklist"
        title="Packing Manager"
        description="Track essentials, filter by trip day, and print the final list."
      />
      <PackingManager initialItems={items} days={days} canEdit={canEdit} />
    </div>
  );
}
