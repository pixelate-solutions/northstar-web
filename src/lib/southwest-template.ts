import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

export interface TemplateDay {
  date: string;
  dayNumber: number;
  title: string;
  location: string;
  sleepLocation?: string | null;
  driveInfo?: string | null;
  notes?: string | null;
  coverImageUrl?: string | null;
}

export interface TemplateEvent {
  dayNumber: number;
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  category: string;
  description?: string | null;
  location?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
  tip?: string | null;
  cost?: string | number | null;
  isBooked?: boolean | null;
  sortOrder?: number | null;
}

export interface TemplateLocation {
  dayNumber: number;
  name: string;
  lat: string;
  lng: string;
  type: string;
  description?: string | null;
  imageUrl?: string | null;
  tip?: string | null;
  googleMapsUrl?: string | null;
}

export interface SouthwestTemplateData {
  days: TemplateDay[];
  events: TemplateEvent[];
  expenses: Array<Record<string, unknown>>;
  packingItems: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  locations: TemplateLocation[];
}

function extractArrayBlock(source: string, name: string) {
  const pattern = new RegExp(`const ${name}[^=]*= \\[(?<body>[\\s\\S]*?)\\n  \\];`);
  const match = source.match(pattern);

  if (!match?.groups?.body) {
    throw new Error(`Unable to locate ${name} in src/db/seed.ts`);
  }

  return `[${match.groups.body}]`;
}

function evaluateArray<T>(literal: string): T {
  return Function(`return (${literal});`)() as T;
}

function normalizeSeedLiteral(name: string, literal: string) {
  if (name === "eventsData" || name === "locationsData") {
    return literal.replace(/dayId:\s*dayMap\.get\((\d+)\)!/g, "dayNumber: $1");
  }

  return literal;
}

export const loadSouthwestTemplate = cache(async (): Promise<SouthwestTemplateData> => {
  const seedFilePath = path.join(process.cwd(), "src/db/seed.ts");
  const source = await fs.readFile(seedFilePath, "utf8");

  const days = evaluateArray<TemplateDay[]>(
    normalizeSeedLiteral("daysData", extractArrayBlock(source, "daysData"))
  );
  const events = evaluateArray<TemplateEvent[]>(
    normalizeSeedLiteral("eventsData", extractArrayBlock(source, "eventsData"))
  );
  const expenses = evaluateArray<Array<Record<string, unknown>>>(
    normalizeSeedLiteral("expensesData", extractArrayBlock(source, "expensesData"))
  );
  const packingItems = evaluateArray<Array<Record<string, unknown>>>(
    normalizeSeedLiteral("packingData", extractArrayBlock(source, "packingData"))
  );
  const reminders = evaluateArray<Array<Record<string, unknown>>>(
    normalizeSeedLiteral("remindersData", extractArrayBlock(source, "remindersData"))
  );
  const locations = evaluateArray<TemplateLocation[]>(
    normalizeSeedLiteral("locationsData", extractArrayBlock(source, "locationsData"))
  );

  return {
    days,
    events,
    expenses,
    packingItems,
    reminders,
    locations,
  };
});
