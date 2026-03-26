import { PageHeader } from "@/components/shared/PageHeader";
import { RemindersManager } from "@/components/reminders/RemindersManager";
import { buildMetadata } from "@/lib/metadata";
import { getDaysOverview, getReminders } from "@/lib/server-data";

export const metadata = buildMetadata("Reminders");
export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const [days, reminders] = await Promise.all([getDaysOverview(), getReminders()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="To-Do"
        title="Reminders"
        description="Track bookings, prep tasks, route checks, and last-minute flight details."
      />
      <RemindersManager initialReminders={reminders} days={days} />
    </div>
  );
}
