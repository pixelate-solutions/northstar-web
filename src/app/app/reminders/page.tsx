import { PageHeader } from "@/components/shared/PageHeader";
import { RemindersManager } from "@/components/reminders/RemindersManager";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentTripContext } from "@/lib/auth";
import { getDaysOverview, getReminders } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";

export const metadata = buildMetadata("Reminders");
export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const context = await getCurrentTripContext();
  if (!context) {
    return null;
  }

  const trip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  if (!trip) {
    return null;
  }

  const [days, reminders] = await Promise.all([
    getDaysOverview(trip.id),
    getReminders(trip.id),
  ]);
  const canEdit = (context.activeTripRole ?? trip.accessRole) !== "viewer";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="To-Do"
        title="Reminders"
        description="Track bookings, prep tasks, route checks, and last-minute travel details."
      />
      <RemindersManager initialReminders={reminders} days={days} canEdit={canEdit} />
    </div>
  );
}
