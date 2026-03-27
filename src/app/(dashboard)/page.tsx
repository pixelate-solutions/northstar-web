import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { buildMetadata } from "@/lib/metadata";
import { getDashboardBundle, getDatabaseWarning } from "@/lib/server-data";
import { getDefaultDate } from "@/lib/trip-data";

export const metadata = buildMetadata("Dashboard");
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const bundle = await getDashboardBundle();
  const defaultDate = getDefaultDate(bundle.days.map((day) => day.date));
  const fallbackDate = bundle.days[0]?.date ?? defaultDate;

  return (
    <DashboardClient
      bundle={bundle}
      defaultDate={
        bundle.days.some((day) => day.date === defaultDate) ? defaultDate : fallbackDate
      }
      databaseWarning={getDatabaseWarning()}
    />
  );
}
