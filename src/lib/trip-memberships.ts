import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { tripMemberships, trips } from "@/db/schema";
import { upsertAppUserFromClerkData } from "@/lib/auth";
import type { TripAccessRole } from "@/lib/types";

type Db = NonNullable<ReturnType<typeof getDb>>;

export const TRIP_MEMBER_ROLE_VALUES = ["viewer", "collaborator"] as const;
export type TripMemberRole = (typeof TRIP_MEMBER_ROLE_VALUES)[number];

export interface TripMemberSummary {
  membershipId: number | null;
  userId: number;
  email: string | null;
  fullName: string | null;
  role: TripAccessRole;
  isOwner: boolean;
}

function requireDb(): Db {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is required.");
  }

  return db;
}

async function requireOwnedTrip(db: Db, ownerUserId: number, tripId: number) {
  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, ownerUserId)),
    with: {
      owner: true,
    },
  });

  if (!trip) {
    throw new Error("Only the trip owner can manage members.");
  }

  return trip;
}

export async function listTripMembersForOwner(ownerUserId: number, tripId: number) {
  const db = requireDb();
  const trip = await requireOwnedTrip(db, ownerUserId, tripId);

  const memberships = await db.query.tripMemberships.findMany({
    where: eq(tripMemberships.tripId, tripId),
    with: {
      user: true,
    },
    orderBy: [tripMemberships.createdAt],
  });

  const owner: TripMemberSummary = {
    membershipId: null,
    userId: trip.owner.id,
    email: trip.owner.email ?? null,
    fullName: trip.owner.fullName ?? null,
    role: "owner",
    isOwner: true,
  };

  return [
    owner,
    ...memberships.map<TripMemberSummary>((membership) => ({
      membershipId: membership.id,
      userId: membership.user.id,
      email: membership.user.email ?? null,
      fullName: membership.user.fullName ?? null,
      role: membership.role === "collaborator" ? "collaborator" : "viewer",
      isOwner: false,
    })),
  ];
}

export async function addTripMemberByEmail(input: {
  ownerUserId: number;
  tripId: number;
  email: string;
  role?: TripMemberRole;
}) {
  const db = requireDb();
  const trip = await requireOwnedTrip(db, input.ownerUserId, input.tripId);
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error("Email is required.");
  }

  if ((trip.owner.email ?? "").toLowerCase() === email) {
    throw new Error("The trip owner already has access.");
  }

  const client = await clerkClient();
  const users = await client.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  const clerkUser = users.data[0];
  if (!clerkUser) {
    throw new Error("That email does not belong to an existing user.");
  }

  const appUser = await upsertAppUserFromClerkData({
    clerkUserId: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress ?? email,
    firstName: clerkUser.firstName ?? null,
    lastName: clerkUser.lastName ?? null,
    username: clerkUser.username ?? null,
  });
  if (!appUser) {
    throw new Error("Unable to create or load the shared user.");
  }

  const role = input.role ?? "viewer";
  const existing = await db.query.tripMemberships.findFirst({
    where: and(eq(tripMemberships.tripId, input.tripId), eq(tripMemberships.userId, appUser.id)),
  });

  if (existing) {
    const [updated] = await db
      .update(tripMemberships)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(tripMemberships.id, existing.id))
      .returning();

    return updated ?? existing;
  }

  const [created] = await db
    .insert(tripMemberships)
    .values({
      tripId: input.tripId,
      userId: appUser.id,
      role,
      addedByUserId: input.ownerUserId,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new Error("Unable to share the trip.");
  }

  return created;
}

export async function updateTripMemberRole(input: {
  ownerUserId: number;
  tripId: number;
  membershipId: number;
  role: TripMemberRole;
}) {
  const db = requireDb();
  await requireOwnedTrip(db, input.ownerUserId, input.tripId);

  const [updated] = await db
    .update(tripMemberships)
    .set({
      role: input.role,
      updatedAt: new Date(),
    })
    .where(
      and(eq(tripMemberships.id, input.membershipId), eq(tripMemberships.tripId, input.tripId))
    )
    .returning();

  if (!updated) {
    throw new Error("Trip member not found.");
  }

  return updated;
}

export async function removeTripMember(input: {
  ownerUserId: number;
  tripId: number;
  membershipId: number;
}) {
  const db = requireDb();
  await requireOwnedTrip(db, input.ownerUserId, input.tripId);

  const [deleted] = await db
    .delete(tripMemberships)
    .where(
      and(eq(tripMemberships.id, input.membershipId), eq(tripMemberships.tripId, input.tripId))
    )
    .returning();

  if (!deleted) {
    throw new Error("Trip member not found.");
  }

  return deleted;
}
