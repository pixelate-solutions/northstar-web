import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { and, asc, eq } from "drizzle-orm";

import { getDb, hasDatabaseUrl } from "@/db";
import {
  days,
  events,
  expenses,
  locations,
  packingItems,
  reminders,
  trips,
} from "@/db/schema";
import { getCurrentTripContext, getInfrastructureWarnings } from "@/lib/auth";
import { ensureStarterTrip } from "@/lib/trips";
import type { AppDataBundle, AppShellData, DaySummary, DayWithDetails } from "@/lib/types";

function resolveCoverImage(coverImageUrl: string | null) {
  return coverImageUrl || null;
}

export function isDatabaseConfigured() {
  return hasDatabaseUrl();
}

export async function getDaysOverview(tripId: number): Promise<DaySummary[]> {
  noStore();
  const db = getDb();
  if (!db) return [];

  const dayRows = await db.query.days.findMany({
    where: eq(days.tripId, tripId),
    with: {
      events: {
        orderBy: [asc(events.sortOrder), asc(events.startTime)],
      },
      locations: true,
    },
    orderBy: [asc(days.date)],
  });

  return dayRows.map((day) => ({
    ...day,
    coverImageUrl: resolveCoverImage(day.coverImageUrl),
    events: day.events,
    locations: day.locations,
    eventCount: day.events.length,
  }));
}

export async function getDayByDate(
  tripId: number,
  date: string
): Promise<DayWithDetails | null> {
  noStore();
  const db = getDb();
  if (!db) return null;

  const day = await db.query.days.findFirst({
    where: and(eq(days.tripId, tripId), eq(days.date, date)),
    with: {
      events: {
        orderBy: [asc(events.sortOrder), asc(events.startTime)],
      },
      locations: true,
    },
  });

  if (!day) {
    return null;
  }

  return {
    ...day,
    coverImageUrl: resolveCoverImage(day.coverImageUrl),
  };
}

export async function getPackingItems(tripId: number) {
  noStore();
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(packingItems)
    .where(eq(packingItems.tripId, tripId))
    .orderBy(asc(packingItems.category), asc(packingItems.name));
}

export async function getExpenses(tripId: number) {
  noStore();
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .orderBy(asc(expenses.category), asc(expenses.description));
}

export async function getReminders(tripId: number) {
  noStore();
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(reminders)
    .where(eq(reminders.tripId, tripId))
    .orderBy(asc(reminders.dueDate), asc(reminders.title));
}

export async function getLocations(dayId?: number) {
  noStore();
  const db = getDb();
  if (!db) return [];

  if (dayId) {
    return db.select().from(locations).where(eq(locations.dayId, dayId));
  }

  return db.select().from(locations).orderBy(asc(locations.dayId), asc(locations.name));
}

export async function getDashboardBundle(tripId: number): Promise<AppDataBundle | null> {
  noStore();
  const db = getDb();
  if (!db) return null;

  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });

  if (!trip) {
    return null;
  }

  const [dayRows, packingRows, expenseRows, reminderRows] = await Promise.all([
    getDaysOverview(tripId),
    getPackingItems(tripId),
    getExpenses(tripId),
    getReminders(tripId),
  ]);

  return {
    trip,
    days: dayRows,
    packingItems: packingRows,
    expenses: expenseRows,
    reminders: reminderRows,
  };
}

export async function getAppShellData(): Promise<AppShellData | null> {
  noStore();
  const context = await getCurrentTripContext();
  if (!context) {
    return null;
  }

  const activeTrip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  if (!activeTrip) {
    return null;
  }

  const bundle = await getDashboardBundle(activeTrip.id);
  if (!bundle) {
    return null;
  }

  const refreshedContext = await getCurrentTripContext();

  return {
    appUser: refreshedContext?.appUser ?? context.appUser,
    trips: refreshedContext?.trips ?? context.trips,
    activeTrip,
    activeTripRole: refreshedContext?.activeTripRole ?? context.activeTripRole ?? activeTrip.accessRole,
    bundle,
  };
}

export function getInfrastructureWarning() {
  const warnings = getInfrastructureWarnings();
  return warnings.length ? warnings.join(" ") : null;
}
