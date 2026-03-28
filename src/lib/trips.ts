import "server-only";

import { addDays, format } from "date-fns";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  appUsers,
  days,
  events,
  tripMemberships,
  trips,
  type AppUser,
  type Trip,
} from "@/db/schema";
import type { TripAccessRole, TripListItem } from "@/lib/types";

interface CreateTripInput {
  user: AppUser;
  name: string;
  destination?: string | null;
  startDate?: string | null;
  totalDays?: number;
}

function sortTripsByFreshness<T extends { updatedAt: Date; createdAt: Date }>(items: T[]) {
  return [...items].sort((a, b) => {
    const updatedDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (updatedDiff !== 0) return updatedDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

function toTripListItem(trip: Trip, accessRole: TripAccessRole): TripListItem {
  return {
    ...trip,
    accessRole,
  };
}

function buildSequentialDates(startDate: string, totalDays: number) {
  const start = new Date(`${startDate}T12:00:00`);
  return Array.from({ length: totalDays }, (_, index) =>
    format(addDays(start, index), "yyyy-MM-dd")
  );
}

function getEventSyncKey({
  dayNumber,
  title,
  sortOrder,
  startTime,
  endTime,
}: {
  dayNumber: number;
  title: string;
  sortOrder: number | null;
  startTime: string | null;
  endTime: string | null;
}) {
  return [
    dayNumber,
    title.trim().toLowerCase(),
    sortOrder ?? 0,
    startTime ?? "",
    endTime ?? "",
  ].join("::");
}

async function getLegacySourceTrip(db: NonNullable<ReturnType<typeof getDb>>) {
  return db.query.trips.findFirst({
    where: eq(trips.templateKey, "legacy-import"),
    with: {
      days: {
        orderBy: [asc(days.dayNumber), asc(days.date)],
        with: {
          events: {
            orderBy: [asc(events.sortOrder), asc(events.startTime)],
          },
          locations: true,
        },
      },
      packingItems: true,
      expenses: true,
      reminders: true,
    },
  });
}

async function repairTripEventLocationsFromLegacy({
  db,
  userId,
  tripId,
}: {
  db: NonNullable<ReturnType<typeof getDb>>;
  userId: number;
  tripId: number;
}) {
  const targetTrip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, userId)),
    with: {
      days: {
        orderBy: [asc(days.dayNumber), asc(days.date)],
        with: {
          events: {
            orderBy: [asc(events.sortOrder), asc(events.startTime)],
          },
        },
      },
    },
  });

  if (!targetTrip || targetTrip.templateKey !== "southwest-road-trip") {
    return 0;
  }

  const targetEvents = targetTrip.days.flatMap((day) => day.events.map((event) => ({ day, event })));
  const alreadyMappedCount = targetEvents.filter(
    ({ event }) => event.lat !== null && event.lng !== null
  ).length;

  if (alreadyMappedCount > 0) {
    return 0;
  }

  const sourceTrip = await getLegacySourceTrip(db);
  if (!sourceTrip) {
    return 0;
  }

  const sourceEvents = new Map(
    sourceTrip.days.flatMap((day) =>
      day.events.map((event) => [
        getEventSyncKey({
          dayNumber: day.dayNumber,
          title: event.title,
          sortOrder: event.sortOrder,
          startTime: event.startTime,
          endTime: event.endTime,
        }),
        event,
      ])
    )
  );

  const updates = targetEvents
    .map(({ day, event }) => {
      const sourceEvent = sourceEvents.get(
        getEventSyncKey({
          dayNumber: day.dayNumber,
          title: event.title,
          sortOrder: event.sortOrder,
          startTime: event.startTime,
          endTime: event.endTime,
        })
      );

      if (!sourceEvent || sourceEvent.lat === null || sourceEvent.lng === null) {
        return null;
      }

      return {
        id: event.id,
        location: sourceEvent.location,
        lat: sourceEvent.lat,
        lng: sourceEvent.lng,
      };
    })
    .filter((update): update is NonNullable<typeof update> => Boolean(update));

  if (!updates.length) {
    return 0;
  }

  await db.transaction(async (tx) => {
    for (const update of updates) {
      await tx
        .update(events)
        .set({
          location: update.location,
          lat: update.lat,
          lng: update.lng,
          updatedAt: new Date(),
        })
        .where(eq(events.id, update.id));
    }
  });

  await db
    .update(trips)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));

  return updates.length;
}

async function listOwnedTripsForUser(userId: number) {
  const db = getDb();
  if (!db) {
    return [];
  }

  return db.query.trips.findMany({
    where: eq(trips.ownerId, userId),
    orderBy: [desc(trips.updatedAt), asc(trips.createdAt)],
  });
}

export async function listTripsForUser(userId: number): Promise<TripListItem[]> {
  const db = getDb();
  if (!db) {
    return [];
  }

  const [ownedTrips, memberships] = await Promise.all([
    listOwnedTripsForUser(userId),
    db.query.tripMemberships.findMany({
      where: eq(tripMemberships.userId, userId),
      with: {
        trip: true,
      },
      orderBy: [desc(tripMemberships.updatedAt), desc(tripMemberships.createdAt)],
    }),
  ]);

  const tripMap = new Map<number, TripListItem>();

  for (const trip of ownedTrips) {
    tripMap.set(trip.id, toTripListItem(trip, "owner"));
  }

  for (const membership of memberships) {
    if (membership.trip.ownerId === userId) {
      continue;
    }

    tripMap.set(
      membership.trip.id,
      toTripListItem(
        membership.trip,
        membership.role === "collaborator" ? "collaborator" : "viewer"
      )
    );
  }

  return sortTripsByFreshness([...tripMap.values()]);
}

export async function getTripRoleForUser(
  userId: number,
  tripId: number
): Promise<TripAccessRole | null> {
  const db = getDb();
  if (!db) {
    return null;
  }

  const ownedTrip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, userId)),
    columns: { id: true },
  });
  if (ownedTrip) {
    return "owner";
  }

  const membership = await db.query.tripMemberships.findFirst({
    where: and(eq(tripMemberships.tripId, tripId), eq(tripMemberships.userId, userId)),
    columns: { role: true },
  });

  if (!membership) {
    return null;
  }

  return membership.role === "collaborator" ? "collaborator" : "viewer";
}

export async function setActiveTrip(userId: number, tripId: number) {
  const db = getDb();
  if (!db) {
    return null;
  }

  const tripRole = await getTripRoleForUser(userId, tripId);
  if (!tripRole) {
    return null;
  }

  const [updatedUser] = await db
    .update(appUsers)
    .set({
      activeTripId: tripId,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, userId))
    .returning();

  return updatedUser ?? null;
}

export async function createTrip({
  user,
  name,
  destination,
  startDate,
  totalDays = 7,
}: CreateTripInput): Promise<Trip | null> {
  const db = getDb();
  if (!db) {
    return null;
  }

  const tripName = name.trim() || "Untitled Trip";

  const safeStartDate = startDate?.trim() || new Date().toISOString().slice(0, 10);
  const parsedTotalDays = Math.max(1, Math.min(60, totalDays));

  const [createdTrip] = await db
    .insert(trips)
    .values({
      ownerId: user.id,
      name: tripName,
      destination: destination?.trim() || null,
      summary: "A blank trip ready for planning.",
      startDate: safeStartDate,
      endDate: buildSequentialDates(safeStartDate, parsedTotalDays).at(-1) ?? safeStartDate,
    })
    .returning();

  if (!createdTrip) {
    return null;
  }

  const dates = buildSequentialDates(safeStartDate, parsedTotalDays);
  await db.insert(days).values(
    dates.map((date, index) => ({
      tripId: createdTrip.id,
      date,
      dayNumber: index + 1,
      title: `Day ${index + 1}`,
      location: "",
      sleepLocation: null,
      driveInfo: null,
      notes: null,
      coverImageUrl: null,
    }))
  );

  await db
    .update(appUsers)
    .set({
      activeTripId: createdTrip.id,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, user.id));

  return createdTrip;
}

export async function ensureStarterTrip(user: AppUser): Promise<TripListItem | null> {
  const existingTrips = await listTripsForUser(user.id);
  if (existingTrips.length) {
    const activeTrip =
      existingTrips.find((trip) => trip.id === user.activeTripId) ?? existingTrips[0];

    if (activeTrip.id !== user.activeTripId) {
      await setActiveTrip(user.id, activeTrip.id);
    }

    const db = getDb();
    if (db) {
      await repairTripEventLocationsFromLegacy({
        db,
        userId: user.id,
        tripId: activeTrip.id,
      });
    }

    return activeTrip;
  }

  const createdTrip = await createTrip({
    user,
    name: "My First Trip",
  });
  return createdTrip ? toTripListItem(createdTrip, "owner") : null;
}

export async function markOnboardingComplete(userId: number) {
  const db = getDb();
  if (!db) {
    return null;
  }

  const [updated] = await db
    .update(appUsers)
    .set({
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, userId))
    .returning();

  return updated ?? null;
}

export async function updateTripDates(tripId: number, startDate: string, totalDays: number) {
  const db = getDb();
  if (!db) {
    return [];
  }

  const targetDates = buildSequentialDates(startDate, totalDays);
  const existingDays = await db.query.days.findMany({
    where: eq(days.tripId, tripId),
    orderBy: [asc(days.dayNumber), asc(days.date)],
  });

  for (const [index, day] of existingDays.entries()) {
    await db
      .update(days)
      .set({
        date: format(addDays(new Date("2100-01-01T12:00:00"), index), "yyyy-MM-dd"),
      })
      .where(eq(days.id, day.id));
  }

  for (const [index, day] of existingDays.slice(0, totalDays).entries()) {
    await db
      .update(days)
      .set({
        date: targetDates[index],
        dayNumber: index + 1,
      })
      .where(eq(days.id, day.id));
  }

  for (const day of existingDays.slice(totalDays)) {
    await db.delete(days).where(eq(days.id, day.id));
  }

  for (let index = existingDays.length; index < totalDays; index += 1) {
    await db.insert(days).values({
      tripId,
      date: targetDates[index],
      dayNumber: index + 1,
      title: `Day ${index + 1}`,
      location: "",
      sleepLocation: null,
      driveInfo: null,
      notes: null,
      coverImageUrl: null,
    });
  }

  await db
    .update(trips)
    .set({
      startDate,
      endDate: targetDates.at(-1) ?? startDate,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));

  return db.query.days.findMany({
    where: eq(days.tripId, tripId),
    orderBy: [asc(days.date)],
    with: {
      events: {
        orderBy: [asc(events.sortOrder), asc(events.startTime)],
      },
      locations: true,
    },
  });
}

export async function deleteTripsOwnedByUser(userId: number) {
  const db = getDb();
  if (!db) {
    return;
  }

  const userTrips = await listOwnedTripsForUser(userId);
  if (!userTrips.length) {
    return;
  }

  await db.delete(trips).where(inArray(trips.id, userTrips.map((trip) => trip.id)));
}

export async function deleteTripForUser(userId: number, tripId: number) {
  const db = getDb();
  if (!db) {
    return null;
  }

  const ownedTrip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, userId)),
    columns: { id: true },
  });

  if (!ownedTrip) {
    return null;
  }

  const remainingTrips = (await listTripsForUser(userId)).filter((trip) => trip.id !== tripId);

  const [deletedTrip] = await db
    .delete(trips)
    .where(and(eq(trips.id, tripId), eq(trips.ownerId, userId)))
    .returning();

  await db
    .update(appUsers)
    .set({
      activeTripId: remainingTrips[0]?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, userId));

  return {
    deletedTrip,
    nextActiveTripId: remainingTrips[0]?.id ?? null,
  };
}
