import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, trips, type AppUser, type Trip } from "@/db/schema";

export function isClerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
      process.env.CLERK_SECRET_KEY?.trim()
  );
}

export async function getAuthenticatedClerkUserId() {
  if (!isClerkConfigured()) {
    return null;
  }

  const { userId } = await auth();
  return userId ?? null;
}

export async function getOrCreateAppUser(): Promise<AppUser | null> {
  const db = getDb();
  const clerkUserId = await getAuthenticatedClerkUserId();

  if (!db || !clerkUserId) {
    return null;
  }

  const existing = await db.query.appUsers.findFirst({
    where: eq(appUsers.clerkUserId, clerkUserId),
  });

  const profile = await currentUser();
  const email = profile?.emailAddresses[0]?.emailAddress ?? null;
  const firstName = profile?.firstName ?? null;
  const lastName = profile?.lastName ?? null;
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || profile?.username || email;

  if (existing) {
    const [updated] = await db
      .update(appUsers)
      .set({
        email,
        firstName,
        lastName,
        fullName,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, existing.id))
      .returning();

    return updated ?? existing;
  }

  const [created] = await db
    .insert(appUsers)
    .values({
      clerkUserId,
      email,
      firstName,
      lastName,
      fullName,
    })
    .returning();

  return created ?? null;
}

export async function getCurrentAppUser() {
  return getOrCreateAppUser();
}

export async function getCurrentTripContext(): Promise<{
  appUser: AppUser;
  trips: Trip[];
  activeTrip: Trip | null;
} | null> {
  const db = getDb();
  const appUser = await getCurrentAppUser();

  if (!db || !appUser) {
    return null;
  }

  const userTrips = await db.query.trips.findMany({
    where: eq(trips.ownerId, appUser.id),
    orderBy: (table, { desc, asc }) => [desc(table.updatedAt), asc(table.createdAt)],
  });

  const activeTrip =
    userTrips.find((trip) => trip.id === appUser.activeTripId) ?? userTrips[0] ?? null;

  return {
    appUser,
    trips: userTrips,
    activeTrip,
  };
}

export async function verifyTripOwnership(tripId: number, userId: number) {
  const db = getDb();
  if (!db) {
    return null;
  }

  return db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, userId)),
  });
}

export function getInfrastructureWarnings() {
  const warnings: string[] = [];

  if (!hasDatabaseUrl()) {
    warnings.push("Set DATABASE_URL to enable saved trips and account-scoped data.");
  }

  if (!isClerkConfigured()) {
    warnings.push(
      "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable authentication."
    );
  }

  return warnings;
}
