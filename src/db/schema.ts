import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  decimal,
  date,
  time,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const days = pgTable("days", {
  id: serial("id").primaryKey(),
  date: date("date").unique().notNull(),
  dayNumber: integer("day_number").notNull(),
  title: text("title").notNull(),
  location: text("location").notNull(),
  sleepLocation: text("sleep_location"),
  driveInfo: text("drive_info"),
  notes: text("notes"),
  coverImageUrl: text("cover_image_url"),
});

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

export const packingItems = pgTable("packing_items", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1),
  isPacked: boolean("is_packed").default(false),
  isEssential: boolean("is_essential").default(false),
  daySpecific: integer("day_specific"),
  notes: text("notes"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isBooked: boolean("is_booked").default(false),
  isPaid: boolean("is_paid").default(false),
  purchaseDate: date("purchase_date"),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),
});

export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  dueDate: date("due_date"),
  isDone: boolean("is_done").default(false),
  priority: text("priority").notNull().default("medium"),
  dayId: integer("day_id").references(() => days.id, { onDelete: "set null" }),
});

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

// Relations
export const daysRelations = relations(days, ({ many }) => ({
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
  day: one(days, { fields: [reminders.dayId], references: [days.id] }),
}));

// Types
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
