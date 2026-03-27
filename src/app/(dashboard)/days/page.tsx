import { TripBuilder } from "@/components/days/TripBuilder";
import { DatabaseBanner } from "@/components/shared/DatabaseBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getDatabaseWarning, getDaysOverview } from "@/lib/server-data";

export const metadata = buildMetadata("Days");
export const dynamic = "force-dynamic";

export default async function DaysSetupPage() {
  const days = await getDaysOverview();
  const databaseWarning = getDatabaseWarning();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Days"
        title="Days"
        description="Create the trip framework, set the number of days, and edit each day's core details before drilling into the full day editor."
      />
      <DatabaseBanner message={databaseWarning} />
      <TripBuilder initialDays={days} canEdit={!databaseWarning} />
    </div>
  );
}
