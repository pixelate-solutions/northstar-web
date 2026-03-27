export type TripStatus =
  | { status: "before"; daysUntil: number }
  | { status: "during"; dayNumber: number; currentDate: string }
  | { status: "after" };

export function getActiveTripDates(tripDates?: string[]) {
  const dates = [...(tripDates ?? [])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return dates;
}

export function getTripStatus(
  now = new Date(),
  tripDates?: string[]
): TripStatus {
  const dates = getActiveTripDates(tripDates);
  if (!dates.length) {
    return { status: "after" };
  }

  const start = new Date(`${dates[0]}T00:00:00`);
  const end = new Date(`${dates[dates.length - 1]}T23:59:59`);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const nowMs = now.getTime();

  if (nowMs < startMs) {
    const daysUntil = Math.ceil((startMs - nowMs) / (1000 * 60 * 60 * 24));
    return { status: "before", daysUntil };
  }

  if (nowMs > endMs) {
    return { status: "after" };
  }

  const dayNumber = Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
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
  now = new Date()
): string {
  const dates = getActiveTripDates(tripDates);
  if (!dates.length) {
    return "Build your next trip";
  }

  const status = getTripStatus(now, dates);

  if (status.status === "before") {
    return `${status.daysUntil} days until departure`;
  }

  if (status.status === "during") {
    return `Day ${status.dayNumber} of ${dates.length}`;
  }

  return "Trip complete";
}
