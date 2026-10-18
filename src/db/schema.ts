import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  decimal,
  index,
  integer,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const appUsers = pgTable(
  "app_users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    fullName: text("full_name"),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    activeTripId: integer("active_trip_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    clerkUserIdx: uniqueIndex("app_users_clerk_user_id_idx").on(table.clerkUserId),
    activeTripIdx: index("app_users_active_trip_id_idx").on(table.activeTripId),
  })
);

export const trips = pgTable(
  "trips",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    destination: text("destination"),
    summary: text("summary"),
    coverImageUrl: text("cover_image_url"),
    templateKey: text("template_key"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("trips_owner_id_idx").on(table.ownerId),
  })
);

export const tripMemberships = pgTable(
  "trip_memberships",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("viewer"),
    addedByUserId: integer("added_by_user_id").references(() => appUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tripIdx: index("trip_memberships_trip_id_idx").on(table.tripId),
    userIdx: index("trip_memberships_user_id_idx").on(table.userId),
    tripUserIdx: uniqueIndex("trip_memberships_trip_id_user_id_idx").on(table.tripId, table.userId),
  })
);

export const days = pgTable(
  "days",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    dayNumber: integer("day_number").notNull(),
    title: text("title").notNull(),
    location: text("location").notNull(),
    sleepLocation: text("sleep_location"),
    driveInfo: text("drive_info"),
    notes: text("notes"),
    coverImageUrl: text("cover_image_url"),
  },
  (table) => ({
    tripDateIdx: uniqueIndex("days_trip_id_date_idx").on(table.tripId, table.date),
    tripDayNumberIdx: uniqueIndex("days_trip_id_day_number_idx").on(
      table.tripId,
      table.dayNumber
    ),
  })
);

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  category: text("category").notNull().default("other"),
  description: text("description"),
  location: text("location"),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  tip: text("tip"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  isBooked: boolean("is_booked").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const packingItems = pgTable(
  "packing_items",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").default(1),
    isPacked: boolean("is_packed").default(false),
    isEssential: boolean("is_essential").default(false),
    daySpecific: integer("day_specific").references(() => days.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
  },
  (table) => ({
    tripIdx: index("packing_items_trip_id_idx").on(table.tripId),
  })
);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    isBooked: boolean("is_booked").default(false),
    isPaid: boolean("is_paid").default(false),
    purchaseDate: date("purchase_date"),
    receiptUrl: text("receipt_url"),
    notes: text("notes"),
  },
  (table) => ({
    tripIdx: index("expenses_trip_id_idx").on(table.tripId),
  })
);

export const reminders = pgTable(
  "reminders",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    dueDate: date("due_date"),
    isDone: boolean("is_done").default(false),
    priority: text("priority").notNull().default("medium"),
    dayId: integer("day_id").references(() => days.id, { onDelete: "set null" }),
  },
  (table) => ({
    tripIdx: index("reminders_trip_id_idx").on(table.tripId),
  })
);

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  type: text("type").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  tip: text("tip"),
  googleMapsUrl: text("google_maps_url"),
});

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("ai_conversations_user_id_idx").on(table.userId),
    tripIdx: index("ai_conversations_trip_id_idx").on(table.tripId),
  })
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    cardsJson: text("cards_json"),
    followupsJson: text("followups_json"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    conversationIdx: index("ai_messages_conversation_id_idx").on(table.conversationId),
  })
);

export const aiApprovals = pgTable(
  "ai_approvals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    conversationId: integer("conversation_id").references(() => aiConversations.id, {
      onDelete: "set null",
    }),
    messageId: integer("message_id").references(() => aiMessages.id, { onDelete: "set null" }),
    approvalType: text("approval_type").notNull(),
    status: text("status").notNull().default("pending"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    payloadJson: text("payload_json"),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    tripIdx: index("ai_approvals_trip_id_idx").on(table.tripId),
    statusIdx: index("ai_approvals_status_idx").on(table.status),
  })
);

export const aiActionLogs = pgTable(
  "ai_action_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    conversationId: integer("conversation_id").references(() => aiConversations.id, {
      onDelete: "set null",
    }),
    messageId: integer("message_id").references(() => aiMessages.id, { onDelete: "set null" }),
    actionType: text("action_type").notNull(),
    summary: text("summary").notNull(),
    detailsJson: text("details_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tripIdx: index("ai_action_logs_trip_id_idx").on(table.tripId),
  })
);

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    accountEmail: text("account_email"),
    externalAccountId: text("external_account_id"),
    scopes: text("scopes"),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    expiresAt: timestamp("expires_at"),
    metadataJson: text("metadata_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userProviderIdx: index("connected_accounts_user_provider_idx").on(
      table.userId,
      table.provider
    ),
  })
);

export const integrationSyncStates = pgTable(
  "integration_sync_states",
  {
    id: serial("id").primaryKey(),
    connectedAccountId: integer("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    cursor: text("cursor"),
    lastSyncedAt: timestamp("last_synced_at"),
    metadataJson: text("metadata_json"),
  },
  (table) => ({
    accountResourceIdx: uniqueIndex("integration_sync_states_account_resource_idx").on(
      table.connectedAccountId,
      table.resource
    ),
  })
);

export const travelerProfiles = pgTable(
  "traveler_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    birthDate: date("birth_date"),
    preferencesJson: text("preferences_json"),
    loyaltyProgramsJson: text("loyalty_programs_json"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("traveler_profiles_user_id_idx").on(table.userId),
  })
);

export const reservations = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    sourceId: text("source_id"),
    category: text("category").notNull(),
    title: text("title").notNull(),
    providerName: text("provider_name"),
    status: text("status").notNull().default("confirmed"),
    confirmationCode: text("confirmation_code"),
    startAt: timestamp("start_at"),
    endAt: timestamp("end_at"),
    timeZone: text("time_zone"),
    location: text("location"),
    priceTotal: decimal("price_total", { precision: 10, scale: 2 }),
    currency: text("currency"),
    detailsJson: text("details_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tripIdx: index("reservations_trip_id_idx").on(table.tripId),
    sourceIdx: index("reservations_source_idx").on(table.source, table.sourceId),
  })
);

export const bookingSearchResults = pgTable(
  "booking_search_results",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    provider: text("provider").notNull(),
    queryText: text("query_text").notNull(),
    resultsJson: text("results_json").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tripIdx: index("booking_search_results_trip_id_idx").on(table.tripId),
  })
);

export const bookingOrders = pgTable(
  "booking_orders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tripId: integer("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    reservationId: integer("reservation_id").references(() => reservations.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("draft"),
    offerId: text("offer_id"),
    title: text("title").notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
    currency: text("currency"),
    externalUrl: text("external_url"),
    payloadJson: text("payload_json"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tripIdx: index("booking_orders_trip_id_idx").on(table.tripId),
  })
);

export const appUsersRelations = relations(appUsers, ({ many }) => ({
  trips: many(trips),
  tripMemberships: many(tripMemberships),
  aiConversations: many(aiConversations),
  approvals: many(aiApprovals),
  actionLogs: many(aiActionLogs),
  connectedAccounts: many(connectedAccounts),
  travelerProfiles: many(travelerProfiles),
  reservations: many(reservations),
  bookingSearchResults: many(bookingSearchResults),
  bookingOrders: many(bookingOrders),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  owner: one(appUsers, { fields: [trips.ownerId], references: [appUsers.id] }),
  memberships: many(tripMemberships),
  days: many(days),
  packingItems: many(packingItems),
  expenses: many(expenses),
  reminders: many(reminders),
  aiConversations: many(aiConversations),
  approvals: many(aiApprovals),
  actionLogs: many(aiActionLogs),
  reservations: many(reservations),
  bookingSearchResults: many(bookingSearchResults),
  bookingOrders: many(bookingOrders),
}));

export const daysRelations = relations(days, ({ one, many }) => ({
  trip: one(trips, { fields: [days.tripId], references: [trips.id] }),
  events: many(events),
  locations: many(locations),
  reminders: many(reminders),
}));

export const tripMembershipsRelations = relations(tripMemberships, ({ one }) => ({
  trip: one(trips, { fields: [tripMemberships.tripId], references: [trips.id] }),
  user: one(appUsers, { fields: [tripMemberships.userId], references: [appUsers.id] }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  day: one(days, { fields: [events.dayId], references: [days.id] }),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  day: one(days, { fields: [locations.dayId], references: [days.id] }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  user: one(appUsers, { fields: [aiConversations.userId], references: [appUsers.id] }),
  trip: one(trips, { fields: [aiConversations.tripId], references: [trips.id] }),
  messages: many(aiMessages),
  approvals: many(aiApprovals),
  actionLogs: many(aiActionLogs),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one, many }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
  approvals: many(aiApprovals),
  actionLogs: many(aiActionLogs),
}));

export const aiApprovalsRelations = relations(aiApprovals, ({ one }) => ({
  user: one(appUsers, { fields: [aiApprovals.userId], references: [appUsers.id] }),
  trip: one(trips, { fields: [aiApprovals.tripId], references: [trips.id] }),
  conversation: one(aiConversations, {
    fields: [aiApprovals.conversationId],
    references: [aiConversations.id],
  }),
  message: one(aiMessages, { fields: [aiApprovals.messageId], references: [aiMessages.id] }),
}));

export const aiActionLogsRelations = relations(aiActionLogs, ({ one }) => ({
  user: one(appUsers, { fields: [aiActionLogs.userId], references: [appUsers.id] }),
  trip: one(trips, { fields: [aiActionLogs.tripId], references: [trips.id] }),
  conversation: one(aiConversations, {
    fields: [aiActionLogs.conversationId],
    references: [aiConversations.id],
  }),
  message: one(aiMessages, { fields: [aiActionLogs.messageId], references: [aiMessages.id] }),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one, many }) => ({
  user: one(appUsers, { fields: [connectedAccounts.userId], references: [appUsers.id] }),
  syncStates: many(integrationSyncStates),
}));

export const integrationSyncStatesRelations = relations(integrationSyncStates, ({ one }) => ({
  connectedAccount: one(connectedAccounts, {
    fields: [integrationSyncStates.connectedAccountId],
    references: [connectedAccounts.id],
  }),
}));

export const travelerProfilesRelations = relations(travelerProfiles, ({ one }) => ({
  user: one(appUsers, { fields: [travelerProfiles.userId], references: [appUsers.id] }),
}));

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  user: one(appUsers, { fields: [reservations.userId], references: [appUsers.id] }),
  trip: one(trips, { fields: [reservations.tripId], references: [trips.id] }),
  bookingOrders: many(bookingOrders),
}));

export const bookingSearchResultsRelations = relations(bookingSearchResults, ({ one }) => ({
  user: one(appUsers, {
    fields: [bookingSearchResults.userId],
    references: [appUsers.id],
  }),
  trip: one(trips, { fields: [bookingSearchResults.tripId], references: [trips.id] }),
}));

export const bookingOrdersRelations = relations(bookingOrders, ({ one }) => ({
  user: one(appUsers, { fields: [bookingOrders.userId], references: [appUsers.id] }),
  trip: one(trips, { fields: [bookingOrders.tripId], references: [trips.id] }),
  reservation: one(reservations, {
    fields: [bookingOrders.reservationId],
    references: [reservations.id],
  }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  trip: one(trips, { fields: [reminders.tripId], references: [trips.id] }),
  day: one(days, { fields: [reminders.dayId], references: [days.id] }),
}));

export const packingItemsRelations = relations(packingItems, ({ one }) => ({
  trip: one(trips, { fields: [packingItems.tripId], references: [trips.id] }),
  day: one(days, { fields: [packingItems.daySpecific], references: [days.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  trip: one(trips, { fields: [expenses.tripId], references: [trips.id] }),
}));

export type AppUser = typeof appUsers.$inferSelect;
export type NewAppUser = typeof appUsers.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type TripMembership = typeof tripMemberships.$inferSelect;
export type NewTripMembership = typeof tripMemberships.$inferInsert;
export type Day = typeof days.$inferSelect;
export type NewDay = typeof days.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type PackingItem = typeof packingItems.$inferSelect;
export type NewPackingItem = typeof packingItems.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type AiConversation = typeof aiConversations.$inferSelect;
export type NewAiConversation = typeof aiConversations.$inferInsert;
export type AiMessage = typeof aiMessages.$inferSelect;
export type NewAiMessage = typeof aiMessages.$inferInsert;
export type AiApproval = typeof aiApprovals.$inferSelect;
export type NewAiApproval = typeof aiApprovals.$inferInsert;
export type AiActionLog = typeof aiActionLogs.$inferSelect;
export type NewAiActionLog = typeof aiActionLogs.$inferInsert;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type NewConnectedAccount = typeof connectedAccounts.$inferInsert;
export type IntegrationSyncState = typeof integrationSyncStates.$inferSelect;
export type NewIntegrationSyncState = typeof integrationSyncStates.$inferInsert;
export type TravelerProfile = typeof travelerProfiles.$inferSelect;
export type NewTravelerProfile = typeof travelerProfiles.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type BookingSearchResult = typeof bookingSearchResults.$inferSelect;
export type NewBookingSearchResult = typeof bookingSearchResults.$inferInsert;
export type BookingOrder = typeof bookingOrders.$inferSelect;
export type NewBookingOrder = typeof bookingOrders.$inferInsert;
