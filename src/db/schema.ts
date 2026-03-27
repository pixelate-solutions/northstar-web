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
    hasLifetimeAccess: boolean("has_lifetime_access").notNull().default(false),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    stripeCustomerId: text("stripe_customer_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
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

export const appUsersRelations = relations(appUsers, ({ many }) => ({
  trips: many(trips),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  owner: one(appUsers, { fields: [trips.ownerId], references: [appUsers.id] }),
  days: many(days),
  packingItems: many(packingItems),
  expenses: many(expenses),
  reminders: many(reminders),
}));

export const daysRelations = relations(days, ({ one, many }) => ({
  trip: one(trips, { fields: [days.tripId], references: [trips.id] }),
  events: many(events),
  locations: many(locations),
  reminders: many(reminders),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  day: one(days, { fields: [events.dayId], references: [days.id] }),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  day: one(days, { fields: [locations.dayId], references: [days.id] }),
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
