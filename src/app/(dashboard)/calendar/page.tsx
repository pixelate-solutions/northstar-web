import { TripCalendar } from "@/components/calendar/TripCalendar";
import { PageHeader } from "@/components/shared/PageHeader";
import { buildMetadata } from "@/lib/metadata";
import { getDaysOverview } from "@/lib/server-data";

export const metadata = buildMetadata("Calendar");
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const days = await getDaysOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planning Grid"
        title="Trip Calendar"
        description="Switch between month, week, and agenda views for the full April 8–18 itinerary."
      />
      <TripCalendar days={days} />
    </div>
  );
}
