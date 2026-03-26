import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { asc, eq } from "drizzle-orm";

import { getDb, hasDatabaseUrl } from "@/db";
import {
  days,
  events,
  expenses,
  locations,
  packingItems,
  reminders,
} from "@/db/schema";
import {
  DAY_IMAGES,
  DAY_LOCATIONS,
  DAY_TITLES,
  TRIP_DATES,
} from "@/lib/trip-data";
import type { AppDataBundle, DaySummary, DayWithDetails } from "@/lib/types";

const BROKEN_IMAGE_IDS = [
  "photo-1558618047-3c8c76ca7d13",
  "photo-1567604460652-9d5e55e6e4ee",
];

function resolveCoverImage(date: string, coverImageUrl: string | null) {
  if (
    !coverImageUrl ||
    BROKEN_IMAGE_IDS.some((imageId) => coverImageUrl.includes(imageId))
  ) {
    return DAY_IMAGES[date] ?? null;
  }

  return coverImageUrl;
}

function buildFallbackDays(): DaySummary[] {
  return TRIP_DATES.map((date, index) => ({
    id: index + 1,
    date,
    dayNumber: index + 1,
    title: DAY_TITLES[date] ?? `Day ${index + 1}`,
    location: DAY_LOCATIONS[date] ?? "",
    sleepLocation: null,
    driveInfo: null,
    notes: null,
    coverImageUrl: DAY_IMAGES[date] ?? null,
    events: [],
    locations: [],
    eventCount: 0,
  }));
}

export function isDatabaseConfigured() {
  return hasDatabaseUrl();
}

export async function getDaysOverview(): Promise<DaySummary[]> {
  noStore();
  const db = getDb();
  if (!db) return buildFallbackDays();

  try {
    const dayRows = await db.query.days.findMany({
      with: {
        events: {
          orderBy: [asc(events.sortOrder), asc(events.startTime)],
        },
        locations: true,
      },
      orderBy: [asc(days.date)],
    });

    if (!dayRows.length) return buildFallbackDays();

    return dayRows.map((day) => ({
      ...day,
      coverImageUrl: resolveCoverImage(day.date, day.coverImageUrl),
      events: day.events,
      locations: day.locations,
      eventCount: day.events.length,
    }));
  } catch {
    return buildFallbackDays();
  }
}

export async function getDayByDate(date: string): Promise<DayWithDetails | null> {
  noStore();
  const fallback = buildFallbackDays().find((day) => day.date === date) ?? null;
  const db = getDb();
  if (!db) return fallback;

  try {
    const day = await db.query.days.findFirst({
      where: eq(days.date, date),
      with: {
        events: {
          orderBy: [asc(events.sortOrder), asc(events.startTime)],
        },
        locations: true,
      },
    });
    return day
      ? {
          ...day,
          coverImageUrl: resolveCoverImage(day.date, day.coverImageUrl),
        }
      : fallback;
  } catch {
    return fallback;
  }
}

export async function getPackingItems() {
  noStore();
  const db = getDb();
  if (!db) return [];

  try {
    return await db.select().from(packingItems).orderBy(asc(packingItems.category), asc(packingItems.name));
  } catch {
    return [];
  }
}

export async function getExpenses() {
  noStore();
  const db = getDb();
  if (!db) return [];

  try {
    return await db.select().from(expenses).orderBy(asc(expenses.category), asc(expenses.description));
  } catch {
    return [];
  }
}

export async function getReminders() {
  noStore();
  const db = getDb();
  if (!db) return [];

  try {
    return await db.select().from(reminders).orderBy(asc(reminders.dueDate), asc(reminders.title));
  } catch {
    return [];
  }
}

export async function getLocations(dayId?: number) {
  noStore();
  const db = getDb();
  if (!db) return [];

  try {
    if (dayId) {
      return await db.select().from(locations).where(eq(locations.dayId, dayId));
    }
    return await db.select().from(locations).orderBy(asc(locations.dayId), asc(locations.name));
  } catch {
    return [];
  }
}

export async function getDashboardBundle(): Promise<AppDataBundle> {
  noStore();
  const [dayRows, packingRows, expenseRows, reminderRows] = await Promise.all([
    getDaysOverview(),
    getPackingItems(),
    getExpenses(),
    getReminders(),
  ]);

  return {
    days: dayRows,
    packingItems: packingRows,
    expenses: expenseRows,
    reminders: reminderRows,
  };
}

export function getDatabaseWarning() {
  if (isDatabaseConfigured()) return null;
  return "DATABASE_URL is not configured yet. Pages render with fallback trip metadata, but CRUD and seeded trip data require Neon + Drizzle setup.";
}
