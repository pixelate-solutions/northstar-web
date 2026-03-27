import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentAppUser } from "@/lib/auth";
import { getDashboardBundle } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";
import { getDefaultDate } from "@/lib/trip-data";
import { OnboardingPanel } from "@/components/shared/OnboardingPanel";

export const metadata = buildMetadata("Dashboard");
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return null;
  }

  const trip = await ensureStarterTrip(appUser);
  if (!trip) {
    return null;
  }

  const bundle = await getDashboardBundle(trip.id);
  if (!bundle) {
    return null;
  }

  const defaultDate = getDefaultDate(bundle.days.map((day) => day.date));
  const fallbackDate = bundle.days[0]?.date ?? defaultDate;

  return (
    <div className="space-y-6">
      {!appUser.onboardingCompleted ? <OnboardingPanel tripName={trip.name} /> : null}
      <DashboardClient
        bundle={bundle}
        defaultDate={
          bundle.days.some((day) => day.date === defaultDate) ? defaultDate : fallbackDate
        }
        databaseWarning={null}
      />
    </div>
  );
}
