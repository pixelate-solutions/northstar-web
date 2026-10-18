import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/AppShell";
import { TripProvider } from "@/components/trip/TripProvider";
import { getAuthenticatedClerkUserId, getCurrentAppUser } from "@/lib/auth";
import type { TripBundle, TripSummary } from "@/lib/client-types";
import { getDashboardBundle } from "@/lib/server-data";
import { ensureStarterTrip, listTripsForUser } from "@/lib/trips";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const clerkUserId = await getAuthenticatedClerkUserId();
  if (!clerkUserId) redirect("/sign-in?redirect_url=/app");

  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/sign-in?redirect_url=/app");

  const activeTrip = await ensureStarterTrip(appUser);
  if (!activeTrip) throw new Error("Unable to load your trip.");

  const [trips, bundle] = await Promise.all([listTripsForUser(appUser.id), getDashboardBundle(activeTrip.id)]);
  if (!bundle) throw new Error("Unable to load trip data.");

  // Server rows -> JSON shape the client store uses (Dates serialize to strings).
  const initialBundle = JSON.parse(JSON.stringify({ ...bundle, role: activeTrip.accessRole })) as TripBundle;
  const tripSummaries: TripSummary[] = trips.map((trip) => ({
    id: trip.id,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    role: trip.accessRole,
  }));

  return (
    <TripProvider
      initialBundle={initialBundle}
      trips={tripSummaries}
      viewer={{
        id: appUser.id,
        name: appUser.firstName ?? appUser.fullName ?? appUser.email ?? "Traveler",
        email: appUser.email,
      }}
    >
      <AppShell>{children}</AppShell>
    </TripProvider>
  );
}
