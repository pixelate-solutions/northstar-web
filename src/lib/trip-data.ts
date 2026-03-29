export type TripStatus =
  | { status: "before"; daysUntil: number }
  | { status: "during"; dayNumber: number; currentDate: string }
  | { status: "after" };

interface TripStatusOptions {
  timeZone?: string;
}

export function getActiveTripDates(tripDates?: string[]) {
  const dates = [...(tripDates ?? [])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return dates;
}

function getDateFormatter(timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getDateStringInTimeZone(date: Date, timeZone?: string) {
  const parts = getDateFormatter(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function getUtcDayTimestamp(date: string) {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function diffCalendarDays(startDate: string, endDate: string) {
  return Math.round((getUtcDayTimestamp(endDate) - getUtcDayTimestamp(startDate)) / 86400000);
}

export function getTripStatus(
  now = new Date(),
  tripDates?: string[],
  options: TripStatusOptions = {}
): TripStatus {
  const dates = getActiveTripDates(tripDates);
  if (!dates.length) {
    return { status: "after" };
  }

  const today = getDateStringInTimeZone(now, options.timeZone);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  if (today < startDate) {
    const daysUntil = diffCalendarDays(today, startDate);
    return { status: "before", daysUntil };
  }

  if (today > endDate) {
    return { status: "after" };
  }

  const dayNumber = diffCalendarDays(startDate, today) + 1;
  const currentDate = dates[dayNumber - 1] ?? dates[0];
  return { status: "during", dayNumber, currentDate };
}

export function getDefaultDate(tripDates?: string[]): string {
  const dates = getActiveTripDates(tripDates);
  if (!dates.length) {
    return new Date().toISOString().slice(0, 10);
  }

  const status = getTripStatus(new Date(), dates);
  if (status.status === "during") return status.currentDate;
  return dates[0];
}

export function getCountdownLabel(
  tripDates?: string[],
  now = new Date(),
  options: TripStatusOptions = {}
): string {
  const dates = getActiveTripDates(tripDates);
  if (!dates.length) {
    return "Build your next trip";
  }

  const status = getTripStatus(now, dates, options);

  if (status.status === "before") {
    return `${status.daysUntil} days until departure`;
  }

  if (status.status === "during") {
    return `Day ${status.dayNumber} of ${dates.length}`;
  }

  return "Trip complete";
}
