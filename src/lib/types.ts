import type {
  AppUser,
  Day,
  Event,
  Expense,
  Location,
  PackingItem,
  Reminder,
  Trip,
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
  trip: Trip;
  days: DaySummary[];
  packingItems: PackingItem[];
  expenses: Expense[];
  reminders: Reminder[];
}

export interface AppShellData {
  appUser: AppUser;
  trips: Trip[];
  activeTrip: Trip;
  bundle: AppDataBundle;
}
