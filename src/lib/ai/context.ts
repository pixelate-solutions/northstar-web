import "server-only";

import { asc, eq } from "drizzle-orm";

import { days, expenses, packingItems, reminders, reservations, travelerProfiles, trips } from "@/db/schema";
import type { AiTripContext } from "@/lib/ai/types";
import type { getDb } from "@/db";

type Db = NonNullable<ReturnType<typeof getDb>>;

export async function buildAiTripContext(db: Db, tripId: number, userId: number): Promise<AiTripContext> {
  const [trip, dayRows, expenseRows, packingRows, reminderRows, reservationRows, profiles] =
    await Promise.all([
      db.query.trips.findFirst({
        where: eq(trips.id, tripId),
      }),
      db.query.days.findMany({
        where: eq(days.tripId, tripId),
        orderBy: [asc(days.dayNumber), asc(days.date)],
        with: {
          events: {
            orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.startTime)],
          },
          locations: {
            orderBy: (table, { asc }) => [asc(table.name)],
          },
        },
      }),
      db.query.expenses.findMany({
        where: eq(expenses.tripId, tripId),
        orderBy: [asc(expenses.category), asc(expenses.description)],
      }),
      db.query.packingItems.findMany({
        where: eq(packingItems.tripId, tripId),
        orderBy: [asc(packingItems.category), asc(packingItems.name)],
      }),
      db.query.reminders.findMany({
        where: eq(reminders.tripId, tripId),
        orderBy: [asc(reminders.dueDate), asc(reminders.title)],
      }),
      db.query.reservations.findMany({
        where: eq(reservations.tripId, tripId),
        orderBy: [asc(reservations.startAt), asc(reservations.title)],
      }),
      db.query.travelerProfiles.findMany({
        where: eq(travelerProfiles.userId, userId),
        orderBy: [asc(travelerProfiles.fullName)],
      }),
    ]);

  if (!trip) {
    throw new Error("Trip not found.");
  }

  return {
    trip: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination ?? null,
      summary: trip.summary ?? null,
      coverImageUrl: trip.coverImageUrl ?? null,
      startDate: trip.startDate ?? null,
      endDate: trip.endDate ?? null,
    },
    days: dayRows.map((day) => ({
      id: day.id,
      date: day.date,
      dayNumber: day.dayNumber,
      title: day.title,
      location: day.location,
      sleepLocation: day.sleepLocation ?? null,
      driveInfo: day.driveInfo ?? null,
      notes: day.notes ?? null,
      coverImageUrl: day.coverImageUrl ?? null,
      events: day.events.map((event) => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime ?? null,
        endTime: event.endTime ?? null,
        category: event.category,
        description: event.description ?? null,
        location: event.location ?? null,
        lat: event.lat ?? null,
        lng: event.lng ?? null,
        tip: event.tip ?? null,
        cost: event.cost ?? null,
        isBooked: event.isBooked ?? null,
        sortOrder: event.sortOrder ?? null,
      })),
      locations: day.locations.map((location) => ({
        id: location.id,
        name: location.name,
        type: location.type,
        lat: location.lat,
        lng: location.lng,
        description: location.description ?? null,
        imageUrl: location.imageUrl ?? null,
        tip: location.tip ?? null,
        googleMapsUrl: location.googleMapsUrl ?? null,
      })),
    })),
    expenses: expenseRows.map((expense) => ({
      id: expense.id,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      isBooked: expense.isBooked ?? null,
      isPaid: expense.isPaid ?? null,
      purchaseDate: expense.purchaseDate ?? null,
      notes: expense.notes ?? null,
    })),
    packingItems: packingRows.map((item) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      quantity: item.quantity ?? null,
      isPacked: item.isPacked ?? null,
      isEssential: item.isEssential ?? null,
      daySpecific: item.daySpecific ?? null,
      notes: item.notes ?? null,
    })),
    reminders: reminderRows.map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      body: reminder.body ?? null,
      dueDate: reminder.dueDate ?? null,
      priority: reminder.priority,
      isDone: reminder.isDone ?? null,
      dayId: reminder.dayId ?? null,
    })),
    reservations: reservationRows.map((reservation) => ({
      id: reservation.id,
      title: reservation.title,
      category: reservation.category,
      source: reservation.source,
      providerName: reservation.providerName ?? null,
      status: reservation.status,
      location: reservation.location ?? null,
      confirmationCode: reservation.confirmationCode ?? null,
      startAt: reservation.startAt ? reservation.startAt.toISOString() : null,
      endAt: reservation.endAt ? reservation.endAt.toISOString() : null,
      timeZone: reservation.timeZone ?? null,
      priceTotal: reservation.priceTotal ?? null,
      currency: reservation.currency ?? null,
    })),
    travelerProfiles: profiles.map((profile) => ({
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      birthDate: profile.birthDate ?? null,
      isDefault: profile.isDefault,
    })),
  };
}

export function formatAiTripContext(context: AiTripContext) {
  return JSON.stringify(context, null, 2);
}
