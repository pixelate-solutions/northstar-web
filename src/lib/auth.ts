import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { getDb, hasDatabaseUrl } from "@/db";
import { appUsers, trips, type AppUser } from "@/db/schema";
import { getTripRoleForUser, listTripsForUser } from "@/lib/trips";
import type { TripAccessRole, TripListItem } from "@/lib/types";

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

function getDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
}) {
  return (
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
    input.username ||
    input.email ||
    null
  );
}

export async function upsertAppUserFromClerkData(input: {
  clerkUserId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  const db = getDb();
  if (!db || !input.clerkUserId) {
    return null;
  }

  const email = input.email ?? null;
  const firstName = input.firstName ?? null;
  const lastName = input.lastName ?? null;
  const fullName = getDisplayName({
    firstName,
    lastName,
    username: input.username ?? null,
    email,
  });

  const existing = await db.query.appUsers.findFirst({
    where: eq(appUsers.clerkUserId, input.clerkUserId),
  });

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
      clerkUserId: input.clerkUserId,
      email,
      firstName,
      lastName,
      fullName,
    })
    .returning();

  return created ?? null;
}

export async function getOrCreateAppUser(): Promise<AppUser | null> {
  const clerkUserId = await getAuthenticatedClerkUserId();

  if (!clerkUserId) {
    return null;
  }

  const profile = await currentUser();
  return upsertAppUserFromClerkData({
    clerkUserId,
    email: profile?.emailAddresses[0]?.emailAddress ?? null,
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    username: profile?.username ?? null,
  });
}

export async function getCurrentAppUser() {
  return getOrCreateAppUser();
}

export async function getCurrentTripContext(): Promise<{
  appUser: AppUser;
  trips: TripListItem[];
  activeTrip: TripListItem | null;
  activeTripRole: TripAccessRole | null;
} | null> {
  const db = getDb();
  const appUser = await getCurrentAppUser();

  if (!db || !appUser) {
    return null;
  }

  const userTrips = await listTripsForUser(appUser.id);

  const activeTrip =
    userTrips.find((trip) => trip.id === appUser.activeTripId) ?? userTrips[0] ?? null;
  const activeTripRole =
    activeTrip?.accessRole ?? (activeTrip ? await getTripRoleForUser(appUser.id, activeTrip.id) : null);

  return {
    appUser,
    trips: userTrips,
    activeTrip,
    activeTripRole,
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
