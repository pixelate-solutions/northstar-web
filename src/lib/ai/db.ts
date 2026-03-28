import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  aiActionLogs,
  aiApprovals,
  aiConversations,
  aiMessages,
  bookingOrders,
  bookingSearchResults,
  connectedAccounts,
  integrationSyncStates,
  reservations,
  travelerProfiles,
  type AiApproval,
  type AiConversation,
  type AiMessage,
  type BookingOrder,
  type BookingSearchResult,
  type ConnectedAccount,
  type IntegrationSyncState,
  type Reservation,
  type TravelerProfile,
} from "@/db/schema";
import type { AiCard } from "@/lib/ai/types";

type Db = NonNullable<ReturnType<typeof getDb>>;

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function serializeJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function requireDb(): Db {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is required for AI features.");
  }
  return db;
}

export async function listAiConversations(db: Db, userId: number, tripId: number) {
  return db.query.aiConversations.findMany({
    where: and(eq(aiConversations.userId, userId), eq(aiConversations.tripId, tripId)),
    orderBy: [desc(aiConversations.lastMessageAt), desc(aiConversations.updatedAt)],
  });
}

export async function getAiConversation(
  db: Db,
  userId: number,
  tripId: number,
  conversationId: number
) {
  return db.query.aiConversations.findFirst({
    where: and(
      eq(aiConversations.id, conversationId),
      eq(aiConversations.userId, userId),
      eq(aiConversations.tripId, tripId)
    ),
  });
}

export async function createAiConversation(
  db: Db,
  userId: number,
  tripId: number,
  title: string
): Promise<AiConversation> {
  const [conversation] = await db
    .insert(aiConversations)
    .values({
      userId,
      tripId,
      title: title.trim() || "New conversation",
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    })
    .returning();

  if (!conversation) {
    throw new Error("Unable to create AI conversation.");
  }

  return conversation;
}

export async function deleteAiConversation(
  db: Db,
  userId: number,
  tripId: number,
  conversationId: number
) {
  const [conversation] = await db
    .delete(aiConversations)
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
        eq(aiConversations.tripId, tripId)
      )
    )
    .returning();

  return conversation ?? null;
}

export async function touchAiConversation(
  db: Db,
  conversationId: number,
  title?: string | null
) {
  await db
    .update(aiConversations)
    .set({
      ...(title ? { title } : {}),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));
}

export async function listAiMessages(db: Db, conversationId: number) {
  const rows = await db.query.aiMessages.findMany({
    where: eq(aiMessages.conversationId, conversationId),
    orderBy: [asc(aiMessages.createdAt), asc(aiMessages.id)],
  });

  return rows.map(hydrateAiMessage);
}

export async function getAiMessage(db: Db, conversationId: number, messageId: number) {
  const message = await db.query.aiMessages.findFirst({
    where: and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.id, messageId)),
  });

  return message ? hydrateAiMessage(message) : null;
}

export function hydrateAiMessage(message: AiMessage) {
  return {
    ...message,
    cards: parseJson<AiCard[]>(message.cardsJson, []),
    followups: parseJson<string[]>(message.followupsJson, []),
    metadata: parseJson<Record<string, unknown> | null>(message.metadataJson, null),
  };
}

export async function createAiMessage(
  db: Db,
  input: {
    conversationId: number;
    role: "user" | "assistant";
    content: string;
    cards?: AiCard[];
    followups?: string[];
    metadata?: Record<string, unknown> | null;
  }
) {
  const [message] = await db
    .insert(aiMessages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      cardsJson: input.cards?.length ? serializeJson(input.cards) : null,
      followupsJson: input.followups?.length ? serializeJson(input.followups) : null,
      metadataJson: input.metadata ? serializeJson(input.metadata) : null,
    })
    .returning();

  if (!message) {
    throw new Error("Unable to save AI message.");
  }

  await touchAiConversation(db, input.conversationId);
  return hydrateAiMessage(message);
}

export async function createAiApproval(
  db: Db,
  input: {
    userId: number;
    tripId: number;
    conversationId: number;
    messageId?: number | null;
    approvalType: string;
    title: string;
    description: string;
    payload?: unknown;
    externalUrl?: string | null;
  }
): Promise<AiApproval> {
  const [approval] = await db
    .insert(aiApprovals)
    .values({
      userId: input.userId,
      tripId: input.tripId,
      conversationId: input.conversationId,
      messageId: input.messageId ?? null,
      approvalType: input.approvalType,
      title: input.title,
      description: input.description,
      payloadJson: input.payload ? serializeJson(input.payload) : null,
      externalUrl: input.externalUrl ?? null,
      status: "pending",
    })
    .returning();

  if (!approval) {
    throw new Error("Unable to create approval.");
  }

  return approval;
}

export async function getAiApproval(
  db: Db,
  userId: number,
  tripId: number,
  approvalId: number
) {
  return db.query.aiApprovals.findFirst({
    where: and(
      eq(aiApprovals.id, approvalId),
      eq(aiApprovals.userId, userId),
      eq(aiApprovals.tripId, tripId)
    ),
  });
}

export async function resolveAiApproval(
  db: Db,
  approvalId: number,
  status: "approved" | "rejected"
) {
  const [approval] = await db
    .update(aiApprovals)
    .set({
      status,
      resolvedAt: new Date(),
    })
    .where(eq(aiApprovals.id, approvalId))
    .returning();

  return approval ?? null;
}

export async function createAiActionLog(
  db: Db,
  input: {
    userId: number;
    tripId: number;
    conversationId?: number | null;
    messageId?: number | null;
    actionType: string;
    summary: string;
    details?: unknown;
  }
) {
  await db.insert(aiActionLogs).values({
    userId: input.userId,
    tripId: input.tripId,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    actionType: input.actionType,
    summary: input.summary,
    detailsJson: input.details ? serializeJson(input.details) : null,
  });
}

export async function listAiActionLogsForMessage(
  db: Db,
  conversationId: number,
  messageId: number
) {
  const rows = await db.query.aiActionLogs.findMany({
    where: and(eq(aiActionLogs.conversationId, conversationId), eq(aiActionLogs.messageId, messageId)),
    orderBy: [desc(aiActionLogs.createdAt), desc(aiActionLogs.id)],
  });

  return rows.map((row) => ({
    ...row,
    details: parseJson<Record<string, unknown> | null>(row.detailsJson, null),
  }));
}

export async function updateAiMessageMetadata(
  db: Db,
  messageId: number,
  metadata: Record<string, unknown> | null
) {
  const [message] = await db
    .update(aiMessages)
    .set({
      metadataJson: metadata ? serializeJson(metadata) : null,
    })
    .where(eq(aiMessages.id, messageId))
    .returning();

  return message ? hydrateAiMessage(message) : null;
}

export async function listConnectedAccounts(db: Db, userId: number, provider?: string) {
  return db.query.connectedAccounts.findMany({
    where: provider
      ? and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.provider, provider))
      : eq(connectedAccounts.userId, userId),
    orderBy: [desc(connectedAccounts.updatedAt)],
  });
}

export async function upsertConnectedAccount(
  db: Db,
  input: Omit<typeof connectedAccounts.$inferInsert, "id" | "createdAt" | "updatedAt">
): Promise<ConnectedAccount> {
  const existing = input.externalAccountId
    ? await db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.userId, input.userId),
          eq(connectedAccounts.provider, input.provider),
          eq(connectedAccounts.externalAccountId, input.externalAccountId)
        ),
      })
    : await db.query.connectedAccounts.findFirst({
        where: and(
          eq(connectedAccounts.userId, input.userId),
          eq(connectedAccounts.provider, input.provider)
        ),
      });

  if (existing) {
    const [updated] = await db
      .update(connectedAccounts)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(connectedAccounts.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Unable to update connected account.");
    }

    return updated;
  }

  const [created] = await db
    .insert(connectedAccounts)
    .values({
      ...input,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new Error("Unable to save connected account.");
  }

  return created;
}

export async function getConnectedAccount(db: Db, userId: number, provider: string) {
  return db.query.connectedAccounts.findFirst({
    where: and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.provider, provider)),
    orderBy: [desc(connectedAccounts.updatedAt)],
  });
}

export async function upsertIntegrationSyncState(
  db: Db,
  connectedAccountId: number,
  resource: string,
  cursor: string | null,
  metadata?: unknown
): Promise<IntegrationSyncState> {
  const existing = await db.query.integrationSyncStates.findFirst({
    where: and(
      eq(integrationSyncStates.connectedAccountId, connectedAccountId),
      eq(integrationSyncStates.resource, resource)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(integrationSyncStates)
      .set({
        cursor,
        metadataJson: metadata ? serializeJson(metadata) : existing.metadataJson,
        lastSyncedAt: new Date(),
      })
      .where(eq(integrationSyncStates.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Unable to update sync state.");
    }

    return updated;
  }

  const [created] = await db
    .insert(integrationSyncStates)
    .values({
      connectedAccountId,
      resource,
      cursor,
      metadataJson: metadata ? serializeJson(metadata) : null,
      lastSyncedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new Error("Unable to create sync state.");
  }

  return created;
}

export async function listTravelerProfiles(db: Db, userId: number) {
  return db.query.travelerProfiles.findMany({
    where: eq(travelerProfiles.userId, userId),
    orderBy: [desc(travelerProfiles.isDefault), asc(travelerProfiles.fullName)],
  });
}

export async function upsertTravelerProfile(
  db: Db,
  input: Omit<typeof travelerProfiles.$inferInsert, "id" | "createdAt" | "updatedAt">
): Promise<TravelerProfile> {
  const existing = input.email
    ? await db.query.travelerProfiles.findFirst({
        where: and(eq(travelerProfiles.userId, input.userId), eq(travelerProfiles.email, input.email)),
      })
    : null;

  if (input.isDefault) {
    await db
      .update(travelerProfiles)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(travelerProfiles.userId, input.userId));
  }

  if (existing) {
    const [updated] = await db
      .update(travelerProfiles)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(travelerProfiles.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Unable to update traveler profile.");
    }

    return updated;
  }

  const [created] = await db
    .insert(travelerProfiles)
    .values({
      ...input,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new Error("Unable to save traveler profile.");
  }

  return created;
}

export async function listReservations(db: Db, userId: number, tripId: number) {
  return db.query.reservations.findMany({
    where: and(eq(reservations.userId, userId), eq(reservations.tripId, tripId)),
    orderBy: [asc(reservations.startAt), asc(reservations.title)],
  });
}

export async function upsertReservation(
  db: Db,
  input: Omit<typeof reservations.$inferInsert, "id" | "createdAt" | "updatedAt">
): Promise<Reservation> {
  const existing = input.sourceId
    ? await db.query.reservations.findFirst({
        where: and(
          eq(reservations.userId, input.userId),
          eq(reservations.tripId, input.tripId),
          eq(reservations.source, input.source),
          eq(reservations.sourceId, input.sourceId)
        ),
      })
    : null;

  if (existing) {
    const [updated] = await db
      .update(reservations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Unable to update reservation.");
    }

    return updated;
  }

  const [created] = await db
    .insert(reservations)
    .values({
      ...input,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new Error("Unable to save reservation.");
  }

  return created;
}

export async function recordBookingSearch(
  db: Db,
  input: Omit<typeof bookingSearchResults.$inferInsert, "id" | "createdAt">
): Promise<BookingSearchResult> {
  const [created] = await db.insert(bookingSearchResults).values(input).returning();
  if (!created) {
    throw new Error("Unable to store booking search results.");
  }
  return created;
}

export async function createBookingOrder(
  db: Db,
  input: Omit<typeof bookingOrders.$inferInsert, "id" | "createdAt" | "updatedAt">
): Promise<BookingOrder> {
  const [created] = await db
    .insert(bookingOrders)
    .values({
      ...input,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new Error("Unable to store booking order.");
  }

  return created;
}
