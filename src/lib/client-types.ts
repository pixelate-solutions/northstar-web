import type { Day, Event, Expense, Location, PackingItem, Reminder, Trip } from "@/db/schema";
import type { TripAccessRole } from "@/lib/types";

/** JSON-serialized form of a server row (Dates become ISO strings). */
type Jsonify<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

export type TripJson = Jsonify<Trip>;
export type EventJson = Jsonify<Event>;
export type LocationJson = Jsonify<Location>;
export type PackingJson = Jsonify<PackingItem>;
export type ExpenseJson = Jsonify<Expense>;
export type ReminderJson = Jsonify<Reminder>;
export type DayJson = Jsonify<Day> & { events: EventJson[]; locations: LocationJson[] };

export interface TripBundle {
  trip: TripJson;
  role: TripAccessRole;
  days: DayJson[];
  packingItems: PackingJson[];
  expenses: ExpenseJson[];
  reminders: ReminderJson[];
}

export interface TripSummary {
  id: number;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  role: TripAccessRole;
}

export interface Viewer {
  id: number;
  name: string;
  email: string | null;
}
