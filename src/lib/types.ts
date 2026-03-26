import type {
  Day,
  Event,
  Expense,
  Location,
  PackingItem,
  Reminder,
} from "@/db/schema";

export interface DayWithDetails extends Day {
  events: Event[];
  locations: Location[];
}

export interface DaySummary extends Day {
  events: Event[];
  locations: Location[];
  eventCount: number;
}

export interface DashboardStats {
  daysUntilOrIntoTrip: number;
  statLabel: string;
  eventsToday: number;
  packingPercent: number;
  totalSpent: number;
  totalBooked: number;
}

export interface AppDataBundle {
  days: DaySummary[];
  packingItems: PackingItem[];
  expenses: Expense[];
  reminders: Reminder[];
}
