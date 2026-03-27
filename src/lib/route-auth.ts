import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { getCurrentTripContext, isClerkConfigured } from "@/lib/auth";
import { ensureStarterTrip } from "@/lib/trips";

export async function requireRouteTripContext(options?: { requirePaid?: boolean }) {
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

  const context = await getCurrentTripContext();
  if (!context) {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  if (options?.requirePaid !== false && !context.appUser.hasLifetimeAccess) {
    return {
      error: NextResponse.json({ error: "Payment required." }, { status: 402 }),
    };
  }

  const activeTrip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  if (!activeTrip) {
    return {
      error: NextResponse.json({ error: "No active trip found." }, { status: 404 }),
    };
  }

  return {
    db,
    appUser: context.appUser,
    activeTrip,
    trips: context.trips,
  };
}

export async function requireOwnedDay(date: string) {
  const context = await requireRouteTripContext();
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
