export const TRIP_START = new Date("2026-04-08T00:00:00");
export const TRIP_END = new Date("2026-04-18T23:59:59");

export const TRIP_DATES = [
  "2026-04-08",
  "2026-04-09",
  "2026-04-10",
  "2026-04-11",
  "2026-04-12",
  "2026-04-13",
  "2026-04-14",
  "2026-04-15",
  "2026-04-16",
  "2026-04-17",
  "2026-04-18",
];

export const DAY_IMAGES: Record<string, string> = {
  "2026-04-08":
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
  "2026-04-09":
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
  "2026-04-10":
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&auto=format&fit=crop",
  "2026-04-11":
    "https://images.unsplash.com/photo-1615551043360-33de8b5f410c?w=800&auto=format&fit=crop",
  "2026-04-12":
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop",
  "2026-04-13":
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop",
  "2026-04-14":
    "https://images.unsplash.com/photo-1604537466608-109fa2f16c3b?w=800&auto=format&fit=crop",
  "2026-04-15":
    "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop",
  "2026-04-16":
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&auto=format&fit=crop",
  "2026-04-17":
    "https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=800&auto=format&fit=crop",
  "2026-04-18":
    "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop",
};

export type TripStatus =
  | { status: "before"; daysUntil: number }
  | { status: "during"; dayNumber: number; currentDate: string }
  | { status: "after" };

export function getTripStatus(now = new Date()): TripStatus {
  const startMs = TRIP_START.getTime();
  const endMs = TRIP_END.getTime();
  const nowMs = now.getTime();

  if (nowMs < startMs) {
    const daysUntil = Math.ceil((startMs - nowMs) / (1000 * 60 * 60 * 24));
    return { status: "before", daysUntil };
  }
  if (nowMs > endMs) {
    return { status: "after" };
  }
  const dayNumber =
    Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
  const currentDate = TRIP_DATES[dayNumber - 1] ?? TRIP_DATES[0];
  return { status: "during", dayNumber, currentDate };
}

export function getDefaultDate(): string {
  const status = getTripStatus();
  if (status.status === "during") return status.currentDate;
  return TRIP_DATES[0];
}

export const DAY_TITLES: Record<string, string> = {
  "2026-04-08": "Travel Day — DTW to PHX",
  "2026-04-09": "Scottsdale Explorer Day",
  "2026-04-10": "Sedona Day",
  "2026-04-11": "Grand Canyon + Page, AZ",
  "2026-04-12": "Zion National Park Day",
  "2026-04-13": "Bryce Canyon Day",
  "2026-04-14": "Bryce → Bridal Veil → Provo",
  "2026-04-15": "Salt Lake City Day",
  "2026-04-16": "Bonneville Salt Flats + Vegas Arrival",
  "2026-04-17": "Vegas Day + Hoover Dam + Scottsdale",
  "2026-04-18": "Fly Home",
};

export const DAY_LOCATIONS: Record<string, string> = {
  "2026-04-08": "Phoenix/Scottsdale, AZ",
  "2026-04-09": "Scottsdale, AZ",
  "2026-04-10": "Sedona, AZ",
  "2026-04-11": "Grand Canyon → Page → Springdale",
  "2026-04-12": "Springdale, UT",
  "2026-04-13": "Bryce Canyon City, UT",
  "2026-04-14": "Provo, UT",
  "2026-04-15": "Salt Lake City, UT",
  "2026-04-16": "SLC → Bonneville → Las Vegas",
  "2026-04-17": "Las Vegas → Scottsdale",
  "2026-04-18": "PHX → DTW",
};
