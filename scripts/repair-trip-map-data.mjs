import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

const VALID_CATEGORIES = new Set([
  "hike",
  "food",
  "drive",
  "flight",
  "sightseeing",
  "accommodation",
  "shopping",
  "entertainment",
  "other",
]);

function normalizeCategory(category, title = "", location = "") {
  const candidate = String(category ?? "").trim().toLowerCase();
  if (VALID_CATEGORIES.has(candidate)) return candidate;

  const search = `${candidate} ${title} ${location}`.toLowerCase();
  if (
    /(restaurant|cafe|café|bakery|brunch|breakfast|lunch|dinner|food|gelato|coffee|pastry|dining)/.test(
      search
    )
  ) {
    return "food";
  }
  if (/(flight|airport|airline|terminal|boarding)/.test(search)) return "flight";
  if (/(travel|drive|transfer|train|transit|taxi|car|ferry|bus)/.test(search)) return "drive";
  if (/(hotel|check-in|check in|stay|lodging|accommodation)/.test(search)) return "accommodation";
  if (/(museum|tour|landmark|sight|gallery|church|cathedral|vatican|colosseum|palace|walk|visit)/.test(search)) {
    return "sightseeing";
  }
  if (/(shop|market|boutique)/.test(search)) return "shopping";
  if (/(show|concert|opera|music|theater|theatre|club)/.test(search)) return "entertainment";
  if (/(hike|trail|park|viewpoint)/.test(search)) return "hike";
  return "other";
}

function getBestGeocodeQuery(event) {
  const location = String(event.location ?? "").trim();
  if (location) {
    const routeMatch = location.match(/\bto\b\s+(.+)$/i);
    if (routeMatch?.[1]) {
      return routeMatch[1].trim();
    }
    return location;
  }

  return `${event.title}, ${event.day_location}`;
}

async function geocodePlace(query) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=1&language=en&format=json`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  const match = json.results?.[0];
  if (!match) return null;

  return {
    label: [match.name, match.admin1, match.country].filter(Boolean).join(", "),
    lat: String(match.latitude),
    lng: String(match.longitude),
  };
}

const tripId = Number(process.argv[2]);
if (!tripId) {
  console.error("Usage: node scripts/repair-trip-map-data.mjs <tripId>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const events = await sql`
  select
    e.id,
    e.title,
    e.category,
    e.location,
    d.location as day_location
  from events e
  join days d on d.id = e.day_id
  where d.trip_id = ${tripId}
  order by d.date, e.sort_order, e.id
`;

let updatedEvents = 0;

for (const event of events) {
  const normalizedCategory = normalizeCategory(event.category, event.title, event.location);
  const geocoded = await geocodePlace(getBestGeocodeQuery(event));

  await sql`
    update events
    set
      category = ${normalizedCategory},
      location = ${geocoded?.label ?? event.location ?? event.day_location},
      lat = ${geocoded?.lat ?? null},
      lng = ${geocoded?.lng ?? null},
      updated_at = now()
    where id = ${event.id}
  `;

  updatedEvents += 1;
}

const deletedLocations = await sql`
  delete from locations
  where day_id in (
    select id from days where trip_id = ${tripId}
  )
  returning id
`;

console.log(
  JSON.stringify(
    {
      tripId,
      updatedEvents,
      deletedLocationRows: deletedLocations.length,
    },
    null,
    2
  )
);
