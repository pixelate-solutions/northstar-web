import { TripBuilder } from "@/components/days/TripBuilder";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentTripContext } from "@/lib/auth";
import { getDaysOverview } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";

export const metadata = buildMetadata("Days");
export const dynamic = "force-dynamic";

export default async function DaysSetupPage() {
  const context = await getCurrentTripContext();
  if (!context) {
    return null;
  }

  const trip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  if (!trip) {
    return null;
  }

  const days = await getDaysOverview(trip.id);
  const canEdit = (context.activeTripRole ?? trip.accessRole) !== "viewer";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Days"
        title="Days"
        description="Create the trip framework, set the number of days, and edit each day before drilling into the full day editor."
      />
      <TripBuilder initialDays={days} canEdit={canEdit} />
    </div>
  );
}
