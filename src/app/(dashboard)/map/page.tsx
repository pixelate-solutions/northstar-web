import nextDynamic from "next/dynamic";

import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getDaysOverview } from "@/lib/server-data";

const TripMap = nextDynamic(
  () => import("@/components/map/TripMap").then((mod) => mod.TripMap),
  { ssr: false }
);

export const metadata = buildMetadata("Map");
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const days = await getDaysOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Route"
        title="Full Trip Map"
        description="Follow the whole Southwest loop, filter by day, and inspect key map pins."
      />
      <TripMap days={days} />
    </div>
  );
}
