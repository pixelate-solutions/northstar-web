import { PackingManager } from "@/components/packing/PackingManager";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentAppUser } from "@/lib/auth";
import { getDaysOverview, getPackingItems } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";

export const metadata = buildMetadata("Packing");
export const dynamic = "force-dynamic";

export default async function PackingPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return null;
  }

  const trip = await ensureStarterTrip(appUser);
  if (!trip) {
    return null;
  }

  const [days, items] = await Promise.all([
    getDaysOverview(trip.id),
    getPackingItems(trip.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Checklist"
        title="Packing Manager"
        description="Track essentials, filter by trip day, and print the final list."
      />
      <PackingManager initialItems={items} days={days} />
    </div>
  );
}
