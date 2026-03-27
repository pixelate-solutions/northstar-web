import { PageHeader } from "@/components/shared/PageHeader";
import { RemindersManager } from "@/components/reminders/RemindersManager";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentAppUser } from "@/lib/auth";
import { getDaysOverview, getReminders } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";

export const metadata = buildMetadata("Reminders");
export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return null;
  }

  const trip = await ensureStarterTrip(appUser);
  if (!trip) {
    return null;
  }

  const [days, reminders] = await Promise.all([
    getDaysOverview(trip.id),
    getReminders(trip.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="To-Do"
        title="Reminders"
        description="Track bookings, prep tasks, route checks, and last-minute travel details."
      />
      <RemindersManager initialReminders={reminders} days={days} />
    </div>
  );
}
