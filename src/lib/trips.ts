import "server-only";

import { addDays, format } from "date-fns";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  appUsers,
  days,
  events,
  expenses,
  locations,
  packingItems,
  reminders,
  trips,
  type AppUser,
  type Trip,
} from "@/db/schema";
import { loadSouthwestTemplate } from "@/lib/southwest-template";

interface CreateTripInput {
  user: AppUser;
  name: string;
  destination?: string | null;
  startDate?: string | null;
  totalDays?: number;
  importTemplate?: boolean;
}

type LegacySourceTrip = Awaited<ReturnType<typeof getLegacySourceTrip>>;

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

async function cloneTripFromLegacySource({
  db,
  user,
  name,
  destination,
  sourceTrip,
}: {
  db: NonNullable<ReturnType<typeof getDb>>;
  user: AppUser;
  name: string;
  destination?: string | null;
  sourceTrip: NonNullable<LegacySourceTrip>;
}) {
  const [createdTrip] = await db
    .insert(trips)
    .values({
      ownerId: user.id,
      name,
      destination: destination ?? sourceTrip.destination ?? "Southwest U.S. Road Trip",
      summary:
        sourceTrip.summary ??
        "Imported Southwest itinerary template with activities, budget, reminders, and locations.",
      coverImageUrl: sourceTrip.coverImageUrl,
      templateKey: "southwest-road-trip",
      startDate: sourceTrip.startDate,
      endDate: sourceTrip.endDate,
    })
    .returning();

  if (!createdTrip) {
    return null;
  }

  const insertedDays = await db
    .insert(days)
    .values(
      sourceTrip.days.map((day) => ({
        tripId: createdTrip.id,
        date: day.date,
        dayNumber: day.dayNumber,
        title: day.title,
        location: day.location,
        sleepLocation: day.sleepLocation,
        driveInfo: day.driveInfo,
        notes: day.notes,
        coverImageUrl: day.coverImageUrl,
      }))
    )
    .returning();

  const dayIdByNumber = new Map(insertedDays.map((day) => [day.dayNumber, day.id]));
  const dayIdByLegacyId = new Map(
    sourceTrip.days.map((day) => [day.id, dayIdByNumber.get(day.dayNumber)!])
  );

  const sourceEvents = sourceTrip.days.flatMap((day) =>
    day.events.map((event) => ({
      dayId: dayIdByNumber.get(day.dayNumber)!,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      category: event.category,
      description: event.description,
      location: event.location,
      lat: event.lat,
      lng: event.lng,
      tip: event.tip,
      cost: event.cost,
      isBooked: event.isBooked,
      sortOrder: event.sortOrder,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }))
  );

  if (sourceEvents.length) {
    await db.insert(events).values(sourceEvents);
  }

  if (sourceTrip.expenses.length) {
    await db.insert(expenses).values(
      sourceTrip.expenses.map((expense) => ({
        tripId: createdTrip.id,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        isBooked: expense.isBooked,
        isPaid: expense.isPaid,
        purchaseDate: expense.purchaseDate,
        receiptUrl: expense.receiptUrl,
        notes: expense.notes,
      }))
    );
  }

  if (sourceTrip.packingItems.length) {
    await db.insert(packingItems).values(
      sourceTrip.packingItems.map((item) => ({
        tripId: createdTrip.id,
        category: item.category,
        name: item.name,
        quantity: item.quantity,
        isPacked: item.isPacked,
        isEssential: item.isEssential,
        daySpecific: item.daySpecific ? dayIdByLegacyId.get(item.daySpecific) ?? null : null,
        notes: item.notes,
      }))
    );
  }

  if (sourceTrip.reminders.length) {
    await db.insert(reminders).values(
      sourceTrip.reminders.map((reminder) => ({
        tripId: createdTrip.id,
        title: reminder.title,
        body: reminder.body,
        dueDate: reminder.dueDate,
        isDone: reminder.isDone,
        priority: reminder.priority,
        dayId: reminder.dayId ? dayIdByLegacyId.get(reminder.dayId) ?? null : null,
      }))
    );
  }

  const sourceLocations = sourceTrip.days.flatMap((day) =>
    day.locations.map((location) => ({
      dayId: dayIdByNumber.get(day.dayNumber)!,
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      type: location.type,
      description: location.description,
      imageUrl: location.imageUrl,
      tip: location.tip,
      googleMapsUrl: location.googleMapsUrl,
    }))
  );

  if (sourceLocations.length) {
    await db.insert(locations).values(sourceLocations);
  }

  await db
    .update(appUsers)
    .set({
      activeTripId: createdTrip.id,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, user.id));

  return createdTrip;
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

export async function listTripsForUser(userId: number) {
  const db = getDb();
  if (!db) {
    return [];
  }

  return db.query.trips.findMany({
    where: eq(trips.ownerId, userId),
    orderBy: [desc(trips.updatedAt), asc(trips.createdAt)],
  });
}

export async function setActiveTrip(userId: number, tripId: number) {
  const db = getDb();
  if (!db) {
    return null;
  }

  const ownedTrip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, userId)),
  });

  if (!ownedTrip) {
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
  importTemplate = false,
}: CreateTripInput): Promise<Trip | null> {
  const db = getDb();
  if (!db) {
    return null;
  }

  const tripName = name.trim() || "Untitled Trip";

  if (importTemplate) {
    const legacySourceTrip = await getLegacySourceTrip(db);
    if (legacySourceTrip) {
      return cloneTripFromLegacySource({
        db,
        user,
        name: tripName,
        destination,
        sourceTrip: legacySourceTrip,
      });
    }

    const template = await loadSouthwestTemplate();
    const [createdTrip] = await db
      .insert(trips)
      .values({
        ownerId: user.id,
        name: tripName,
        destination: destination ?? "Southwest U.S. Road Trip",
        summary:
          "Imported Southwest itinerary template with activities, budget, reminders, and locations.",
        coverImageUrl: template.days[0]?.coverImageUrl ?? null,
        templateKey: "southwest-road-trip",
        startDate: template.days[0]?.date ?? null,
        endDate: template.days.at(-1)?.date ?? null,
      })
      .returning();

    if (!createdTrip) {
      return null;
    }

    const insertedDays = await db
      .insert(days)
      .values(
        template.days.map((day) => ({
          tripId: createdTrip.id,
          date: day.date,
          dayNumber: day.dayNumber,
          title: day.title,
          location: day.location,
          sleepLocation: day.sleepLocation ?? null,
          driveInfo: day.driveInfo ?? null,
          notes: day.notes ?? null,
          coverImageUrl: day.coverImageUrl ?? null,
        }))
      )
      .returning();

    const dayIdByNumber = new Map(insertedDays.map((day) => [day.dayNumber, day.id]));

    if (template.events.length) {
      await db.insert(events).values(
        template.events.map((event) => ({
          dayId: dayIdByNumber.get(event.dayNumber)!,
          title: event.title,
          startTime: event.startTime ?? null,
          endTime: event.endTime ?? null,
          category: event.category,
          description: event.description ?? null,
          location: event.location ?? null,
          lat:
            event.lat === undefined || event.lat === null || event.lat === ""
              ? null
              : String(event.lat),
          lng:
            event.lng === undefined || event.lng === null || event.lng === ""
              ? null
              : String(event.lng),
          tip: event.tip ?? null,
          cost:
            event.cost === undefined || event.cost === null || event.cost === ""
              ? null
              : String(event.cost),
          isBooked: Boolean(event.isBooked),
          sortOrder: event.sortOrder ?? 0,
        }))
      );
    }

    if (template.expenses.length) {
      await db.insert(expenses).values(
        template.expenses.map((expense) => ({
          tripId: createdTrip.id,
          category: String(expense.category ?? "other"),
          description: String(expense.description ?? ""),
          amount: String(expense.amount ?? 0),
          isBooked: Boolean(expense.isBooked),
          isPaid: Boolean(expense.isPaid),
          purchaseDate: (expense.purchaseDate as string | null | undefined) ?? null,
          receiptUrl: (expense.receiptUrl as string | null | undefined) ?? null,
          notes: (expense.notes as string | null | undefined) ?? null,
        }))
      );
    }

    if (template.packingItems.length) {
      await db.insert(packingItems).values(
        template.packingItems.map((item) => ({
          tripId: createdTrip.id,
          category: String(item.category ?? "other"),
          name: String(item.name ?? ""),
          quantity: Number(item.quantity ?? 1),
          isPacked: Boolean(item.isPacked),
          isEssential: Boolean(item.isEssential),
          notes: (item.notes as string | null | undefined) ?? null,
        }))
      );
    }

    if (template.reminders.length) {
      await db.insert(reminders).values(
        template.reminders.map((reminder) => ({
          tripId: createdTrip.id,
          title: String(reminder.title ?? ""),
          body: (reminder.body as string | null | undefined) ?? null,
          dueDate: (reminder.dueDate as string | null | undefined) ?? null,
          isDone: Boolean(reminder.isDone),
          priority:
            (reminder.priority as "high" | "medium" | "low" | undefined) ?? "medium",
        }))
      );
    }

    if (template.locations.length) {
      await db.insert(locations).values(
        template.locations.map((location) => ({
          dayId: dayIdByNumber.get(location.dayNumber)!,
          name: location.name,
          lat: location.lat,
          lng: location.lng,
          type: location.type,
          description: location.description ?? null,
          imageUrl: location.imageUrl ?? null,
          tip: location.tip ?? null,
          googleMapsUrl: location.googleMapsUrl ?? null,
        }))
      );
    }

    await db
      .update(appUsers)
      .set({
        activeTripId: createdTrip.id,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, user.id));

    return createdTrip;
  }

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

export async function ensureStarterTrip(user: AppUser) {
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

  return createTrip({
    user,
    name: "Southwest Road Trip",
    importTemplate: true,
  });
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

  await db.transaction(async (tx) => {
    for (const [index, day] of existingDays.entries()) {
      await tx
        .update(days)
        .set({ date: format(addDays(new Date("2100-01-01T12:00:00"), index), "yyyy-MM-dd") })
        .where(eq(days.id, day.id));
    }

    for (const [index, day] of existingDays.slice(0, totalDays).entries()) {
      await tx
        .update(days)
        .set({
          date: targetDates[index],
          dayNumber: index + 1,
        })
        .where(eq(days.id, day.id));
    }

    for (const day of existingDays.slice(totalDays)) {
      await tx.delete(days).where(eq(days.id, day.id));
    }

    for (let index = existingDays.length; index < totalDays; index += 1) {
      await tx.insert(days).values({
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
  });

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

  const userTrips = await listTripsForUser(userId);
  if (!userTrips.length) {
    return;
  }

  await db.delete(trips).where(inArray(trips.id, userTrips.map((trip) => trip.id)));
}
