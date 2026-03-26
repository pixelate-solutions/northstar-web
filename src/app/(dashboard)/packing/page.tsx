import { PackingManager } from "@/components/packing/PackingManager";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getDaysOverview, getPackingItems } from "@/lib/server-data";

export const metadata = buildMetadata("Packing");
export const dynamic = "force-dynamic";

export default async function PackingPage() {
  const [days, items] = await Promise.all([getDaysOverview(), getPackingItems()]);

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
