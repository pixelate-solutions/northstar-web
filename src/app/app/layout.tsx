import { redirect } from "next/navigation";

import { MobileHeader } from "@/components/nav/MobileHeader";
import { AiConciergeSheet } from "@/components/ai/AiConciergeSheet";
import { Sidebar } from "@/components/nav/Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getAuthenticatedClerkUserId, getCurrentAppUser, isClerkConfigured } from "@/lib/auth";
import { getDashboardBundle, getInfrastructureWarning } from "@/lib/server-data";
import { ensureStarterTrip, listTripsForUser } from "@/lib/trips";
import { getCountdownLabel } from "@/lib/trip-data";

function SetupState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <div className="w-full rounded-[2rem] border border-border/70 bg-card/85 p-10 shadow-[0_30px_80px_rgba(18,43,74,0.10)]">
        <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Setup Required</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Finish the SaaS configuration</h1>
        <p className="mt-4 text-base text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const warning = getInfrastructureWarning();
  if (warning) {
    return <SetupState message={warning} />;
  }

  if (!isClerkConfigured()) {
    return <SetupState message="Add your Clerk keys to unlock authentication." />;
  }

  const clerkUserId = await getAuthenticatedClerkUserId();
  if (!clerkUserId) {
    redirect("/sign-in");
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect("/sign-in");
  }

  if (!appUser.hasLifetimeAccess) {
    redirect("/unlock");
  }

  const activeTrip = await ensureStarterTrip(appUser);
  if (!activeTrip) {
    return <SetupState message="Unable to load the active trip." />;
  }

  const [allTrips, bundle] = await Promise.all([
    listTripsForUser(appUser.id),
    getDashboardBundle(activeTrip.id),
  ]);

  if (!bundle) {
    return <SetupState message="Unable to load trip data." />;
  }

  const countdownLabel = getCountdownLabel(
    bundle.days.map((day) => day.date),
    new Date()
  );
  const tripDates = bundle.days.map((day) => day.date);

  const totalBooked = bundle.expenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );
  const packingPercent = bundle.packingItems.length
    ? Math.round(
        (bundle.packingItems.filter((item) => Boolean(item.isPacked)).length /
          bundle.packingItems.length) *
          100
      )
    : 0;
  const daysHref = bundle.days[0] ? `/app/days/${bundle.days[0].date}` : "/app/days";
  const activeTripRole = activeTrip.accessRole;
  const canEditActiveTrip = activeTripRole !== "viewer";
  const canManageTripUsers = activeTripRole === "owner";

  return (
    <SidebarProvider>
      <div className="relative isolate min-h-screen bg-transparent text-foreground">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[44rem] bg-[radial-gradient(circle_at_top_left,rgba(33,91,137,0.18),transparent_26%),radial-gradient(circle_at_22%_8%,rgba(53,173,168,0.18),transparent_22%),radial-gradient(circle_at_top_right,rgba(191,224,227,0.24),transparent_28%),linear-gradient(180deg,rgba(248,252,253,0.92)_0%,rgba(244,249,250,0.90)_52%,rgba(251,253,253,0.92)_100%)] [mask-image:linear-gradient(to_bottom,black_0%,black_74%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_74%,transparent_100%)]" />
        <MobileHeader
          activeTripId={activeTrip.id}
          activeTripRole={activeTripRole}
          canEditActiveTrip={canEditActiveTrip}
          canManageTripUsers={canManageTripUsers}
          countdownLabel={countdownLabel}
          daysHref={daysHref}
          tripDates={tripDates}
          tripName={activeTrip.name}
          trips={allTrips.map((trip) => ({
            id: trip.id,
            name: trip.name,
            accessRole: trip.accessRole,
          }))}
        />
        <div className="mx-auto flex min-h-screen max-w-[1600px] lg:my-5 lg:min-h-[calc(100vh-2.5rem)] lg:max-w-[calc(100%-2.5rem)]">
          <Sidebar
            activeTripId={activeTrip.id}
            activeTripRole={activeTripRole}
            canEditActiveTrip={canEditActiveTrip}
            canManageTripUsers={canManageTripUsers}
            trips={allTrips.map((trip) => ({
              id: trip.id,
              name: trip.name,
              accessRole: trip.accessRole,
            }))}
            tripName={activeTrip.name}
            daysHref={daysHref}
            packingPercent={packingPercent}
            totalBooked={totalBooked}
            countdownLabel={countdownLabel}
            tripDates={tripDates}
          />
          <div className="min-w-0 flex-1 lg:rounded-[2.75rem] lg:border lg:border-white/50 lg:bg-white/28 lg:p-2 lg:shadow-[0_32px_110px_rgba(17,46,72,0.14),inset_0_1px_0_rgba(255,255,255,0.75)] lg:backdrop-blur-2xl">
            <main className="min-w-0 [overflow-x:clip] px-4 pb-8 pt-16 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">
              {children}
            </main>
          </div>
        </div>
        <AiConciergeSheet tripName={activeTrip.name} enabled={canEditActiveTrip} />
      </div>
    </SidebarProvider>
  );
}
