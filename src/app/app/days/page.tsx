import { TripBuilder } from "@/components/days/TripBuilder";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentAppUser } from "@/lib/auth";
import { getDaysOverview } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";

export const metadata = buildMetadata("Days");
export const dynamic = "force-dynamic";

export default async function DaysSetupPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return null;
  }

  const trip = await ensureStarterTrip(appUser);
  if (!trip) {
    return null;
  }

  const days = await getDaysOverview(trip.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Days"
        title="Days"
        description="Create the trip framework, set the number of days, and edit each day before drilling into the full day editor."
      />
      <TripBuilder initialDays={days} canEdit />
    </div>
  );
}
