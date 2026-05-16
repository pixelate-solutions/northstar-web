import type { AppDataBundle, DashboardStats } from "@/lib/types";
import { getTripStatus } from "@/lib/trip-data";
import { pluralize } from "@/lib/utils";

export function getDashboardStats(
  bundle: AppDataBundle,
  selectedDate: string,
  timeZone?: string
): DashboardStats {
  const status = getTripStatus(new Date(), bundle.days.map((day) => day.date), { timeZone });
  const packingPercent = bundle.packingItems.length
    ? Math.round(
        (bundle.packingItems.filter((item) => item.isPacked).length /
          bundle.packingItems.length) *
          100
      )
    : 0;

  const totalSpent = bundle.expenses
    .filter((expense) => expense.isPaid)
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const totalBooked = bundle.expenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );

  const selectedDay = bundle.days.find((day) => day.date === selectedDate);

  if (status.status === "before") {
    return {
      daysUntilOrIntoTrip: status.daysUntil,
      statLabel: `${pluralize(status.daysUntil, "day")} until departure`,
      eventsToday: selectedDay?.eventCount ?? 0,
      packingPercent,
      totalSpent,
      totalBooked,
    };
  }

  if (status.status === "during") {
    return {
      daysUntilOrIntoTrip: status.dayNumber,
      statLabel: `${pluralize(status.dayNumber, "day")} into the trip`,
      eventsToday: selectedDay?.eventCount ?? 0,
      packingPercent,
      totalSpent,
      totalBooked,
    };
  }

  return {
    daysUntilOrIntoTrip: bundle.days.length,
    statLabel: `${pluralize(bundle.days.length, "day")} completed`,
    eventsToday: selectedDay?.eventCount ?? 0,
    packingPercent,
    totalSpent,
    totalBooked,
  };
}
