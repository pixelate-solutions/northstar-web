import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { getCurrentTripContext, isClerkConfigured } from "@/lib/auth";
import { ensureStarterTrip } from "@/lib/trips";
import type { TripAccessRole } from "@/lib/types";

const TRIP_ROLE_LEVELS: Record<TripAccessRole, number> = {
  viewer: 1,
  collaborator: 2,
  owner: 3,
};

export async function requireRouteTripContext(options?: {
  minimumRole?: TripAccessRole;
  /** Use this trip (if the user can access it) instead of the x-trip-id header / last-opened trip. */
  tripId?: number;
}) {
  const db = getDb();
  if (!db) {
    return {
      error: NextResponse.json(
        { error: "DATABASE_URL is required before app data can be changed." },
        { status: 503 }
      ),
    };
  }

  if (!isClerkConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Clerk environment variables are required before account routes can run." },
        { status: 503 }
      ),
    };
  }

  const context = await getCurrentTripContext({ tripId: options?.tripId });
  if (!context) {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const activeTrip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  if (!activeTrip) {
    return {
      error: NextResponse.json({ error: "No active trip found." }, { status: 404 }),
    };
  }

  const activeTripRole = context.activeTripRole ?? activeTrip.accessRole;
  const minimumRole = options?.minimumRole ?? "viewer";
  if (
    !activeTripRole ||
    TRIP_ROLE_LEVELS[activeTripRole] < TRIP_ROLE_LEVELS[minimumRole]
  ) {
    return {
      error: NextResponse.json(
        { error: minimumRole === "owner" ? "Only the trip owner can do that." : "You do not have permission to edit this trip." },
        { status: 403 }
      ),
    };
  }

  return {
    db,
    appUser: context.appUser,
    activeTrip,
    activeTripRole,
    trips: context.trips,
  };
}

export async function requireOwnedDay(
  date: string,
  options?: { minimumRole?: TripAccessRole }
) {
  const context = await requireRouteTripContext({ minimumRole: options?.minimumRole ?? "collaborator" });
  if ("error" in context) {
    return context;
  }

  const day = await context.db.query.days.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.tripId, context.activeTrip.id), eq(table.date, date)),
  });

  if (!day) {
    return {
      error: NextResponse.json({ error: "Day not found." }, { status: 404 }),
    };
  }

  return {
    ...context,
    day,
  };
}
