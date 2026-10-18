import "server-only";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import {
  days,
  events,
  expenses,
  locations,
  packingItems,
  reminders,
  trips,
  type AppUser,
  type Trip,
} from "@/db/schema";
import {
  createAiActionLog,
  createAiConversation,
  createAiMessage,
  getAiConversation,
  getAiMessage,
  listAiMessages,
  listAiActionLogsForMessage,
  requireDb,
  updateAiMessageMetadata,
} from "@/lib/ai/db";
import { buildAiTripContext, formatAiTripContext } from "@/lib/ai/context";
import { estimateRoute, geocodePlace } from "@/lib/ai/geo";
import {
  buildFunctionCallOutput,
  createOpenAiResponse,
  getFunctionCalls,
  getResponseSources,
  getResponseText,
  isOpenAiConfigured,
} from "@/lib/ai/openai";
import { CATEGORIES } from "@/lib/category-config";
import { updateTripDates } from "@/lib/trips";
import type {
  AiCard,
  AiTripContext,
  AiUploadedFile,
  ToolExecutionArtifact,
} from "@/lib/ai/types";

type Db = NonNullable<ReturnType<typeof getDb>>;

// gpt-6-luna has a 1.05M-token context window, so the full trip and full chat history are sent every turn.
export const AI_MODEL = "gpt-6-luna";
const AI_REASONING_EFFORT = "medium";
const MAX_TOOL_ROUNDS = 24;
// ~4 chars per token; keep the transcript well inside the 1M window alongside the trip context.
const MAX_HISTORY_CHARS = 2_400_000;
const EVENT_CATEGORY_VALUES = [
  "hike",
  "food",
  "drive",
  "flight",
  "sightseeing",
  "accommodation",
  "shopping",
  "entertainment",
  "other",
] as const;
const PACKING_CATEGORY_VALUES = [
  "documents",
  "electronics",
  "clothing",
  "footwear",
  "toiletries",
  "health",
  "accessories",
  "bags",
  "beach",
  "food",
  "other",
] as const;
const eventCategorySchema = z.enum(EVENT_CATEGORY_VALUES);
const nullableEventCategorySchema = z.union([eventCategorySchema, z.null()]).transform((value) => value);

function createAbortError() {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function revalidateTripViews() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/calendar");
  revalidatePath("/app/days");
  revalidatePath("/app/days/[date]", "page");
  revalidatePath("/app/packing");
  revalidatePath("/app/budget");
  revalidatePath("/app/reminders");
}

async function touchTrip(db: Db, tripId: number) {
  await db
    .update(trips)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));
}

const nullableStringSchema = () =>
  z.union([z.string(), z.null()]).transform((value) => value);
const nullableNumberSchema = () =>
  z.union([z.number(), z.null()]).transform((value) => value);
const nullableBooleanSchema = () =>
  z.union([z.boolean(), z.null()]).transform((value) => value);
const itineraryEventSchema = z.object({
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  category: eventCategorySchema,
  description: nullableStringSchema(),
  location: nullableStringSchema(),
  latitude: nullableNumberSchema(),
  longitude: nullableNumberSchema(),
  tip: nullableStringSchema(),
  cost: nullableNumberSchema(),
  isBooked: z.boolean(),
});
const packingItemInputSchema = z.object({
  category: z.string(),
  name: z.string(),
  quantity: z.number(),
  isPacked: z.boolean(),
  isEssential: z.boolean(),
  dayDate: nullableStringSchema(),
  notes: nullableStringSchema(),
});
const expenseInputSchema = z.object({
  category: z.string(),
  description: z.string(),
  amount: z.number(),
  isBooked: z.boolean(),
  isPaid: z.boolean(),
  purchaseDate: nullableStringSchema(),
  notes: nullableStringSchema(),
  receiptUrl: nullableStringSchema(),
});
const tripDayInputSchema = z.object({
  date: z.string(),
  title: z.string(),
  location: z.string(),
  sleepLocation: nullableStringSchema(),
  driveInfo: nullableStringSchema(),
  notes: nullableStringSchema(),
  coverImageUrl: nullableStringSchema(),
});

const toolValidators = {
  set_trip_structure: z.object({
    name: nullableStringSchema(),
    destination: nullableStringSchema(),
    summary: nullableStringSchema(),
    startDate: z.string(),
    replaceExisting: z.boolean(),
    days: z.array(tripDayInputSchema).min(1).max(60),
  }),
  update_trip_details: z.object({
    name: nullableStringSchema(),
    destination: nullableStringSchema(),
    summary: nullableStringSchema(),
    coverImageUrl: nullableStringSchema(),
  }),
  update_day_details: z.object({
    date: z.string(),
    title: nullableStringSchema(),
    location: nullableStringSchema(),
    sleepLocation: nullableStringSchema(),
    driveInfo: nullableStringSchema(),
    notes: nullableStringSchema(),
    coverImageUrl: nullableStringSchema(),
  }),
  create_event: z.object({
    date: z.string(),
    title: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    category: eventCategorySchema,
    description: nullableStringSchema(),
    location: nullableStringSchema(),
    latitude: nullableNumberSchema(),
    longitude: nullableNumberSchema(),
    tip: nullableStringSchema(),
    cost: nullableNumberSchema(),
    isBooked: z.boolean(),
  }),
  set_day_itinerary: z.object({
    date: z.string(),
    replaceExisting: z.boolean(),
    events: z.array(itineraryEventSchema).min(1),
  }),
  update_event: z.object({
    eventId: z.number(),
    title: nullableStringSchema(),
    startTime: nullableStringSchema(),
    endTime: nullableStringSchema(),
    category: nullableEventCategorySchema,
    description: nullableStringSchema(),
    location: nullableStringSchema(),
    latitude: nullableNumberSchema(),
    longitude: nullableNumberSchema(),
    tip: nullableStringSchema(),
    cost: nullableNumberSchema(),
    isBooked: nullableBooleanSchema(),
  }),
  delete_event: z.object({
    eventId: z.number(),
    reason: z.string(),
  }),
  create_expense: z.object({
    category: z.string(),
    description: z.string(),
    amount: z.number(),
    isBooked: z.boolean(),
    isPaid: z.boolean(),
    purchaseDate: nullableStringSchema(),
    notes: nullableStringSchema(),
    receiptUrl: nullableStringSchema(),
  }),
  set_budget_items: z.object({
    replaceExisting: z.boolean(),
    items: z.array(expenseInputSchema).min(1),
  }),
  create_packing_item: z.object({
    category: z.string(),
    name: z.string(),
    quantity: z.number(),
    isPacked: z.boolean(),
    isEssential: z.boolean(),
    dayDate: nullableStringSchema(),
    notes: nullableStringSchema(),
  }),
  set_packing_list: z.object({
    replaceExisting: z.boolean(),
    items: z.array(packingItemInputSchema).min(1),
  }),
  create_reminder: z.object({
    title: z.string(),
    body: nullableStringSchema(),
    dueDate: nullableStringSchema(),
    priority: z.enum(["high", "medium", "low"]),
    dayDate: nullableStringSchema(),
  }),
  update_list_items: z.object({
    items: z.array(
      z.object({
        kind: z.enum(["packing", "todo", "expense"]),
        id: z.number().int(),
        action: z.enum(["update", "delete"]),
        done: nullableBooleanSchema(),
        title: nullableStringSchema(),
        amount: nullableNumberSchema(),
      })
    ),
  }),
  estimate_route: z.object({
    origin: z.string(),
    destination: z.string(),
  }),
} satisfies Record<string, z.ZodTypeAny>;

const toolDefinitions = [
  {
    type: "function",
    name: "set_trip_structure",
    description:
      "Overwrite the active trip's day structure, dates, day titles, locations, and trip details. Use this when a user asks to plan a new trip, replace a blank/default starter trip, change the trip year/duration, or build a trip from an uploaded itinerary. This can replace the existing default days; the user can undo it.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        destination: { type: ["string", "null"] },
        summary: { type: ["string", "null"] },
        startDate: { type: "string" },
        replaceExisting: {
          type: "boolean",
          description:
            "Use true when replacing blank/default content or when the user asks to overwrite the trip.",
        },
        days: {
          type: "array",
          minItems: 1,
          maxItems: 60,
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              title: { type: "string" },
              location: { type: "string" },
              sleepLocation: { type: ["string", "null"] },
              driveInfo: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
              coverImageUrl: { type: ["string", "null"] },
            },
            required: [
              "date",
              "title",
              "location",
              "sleepLocation",
              "driveInfo",
              "notes",
              "coverImageUrl",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["name", "destination", "summary", "startDate", "replaceExisting", "days"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_trip_details",
    description: "Update the active trip's high-level details such as the trip name, destination, summary, or cover image.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        destination: { type: ["string", "null"] },
        summary: { type: ["string", "null"] },
        coverImageUrl: { type: ["string", "null"] },
      },
      required: ["name", "destination", "summary", "coverImageUrl"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_day_details",
    description:
      "Update the title, location, notes, logistics, or cover image for a single day in the active trip. Before using this for requests like rename, adjust, rewrite, or reflect the current schedule, inspect the current day state and event list first.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        date: { type: "string" },
        title: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        sleepLocation: { type: ["string", "null"] },
        driveInfo: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        coverImageUrl: { type: ["string", "null"] },
      },
      required: ["date", "title", "location", "sleepLocation", "driveInfo", "notes", "coverImageUrl"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_event",
    description:
      "Create a new itinerary event on a specific day in the active trip using a real, specific place or tour whenever the user asked for research-backed recommendations. If you do not already know the exact venue/address and coordinates, use web search first, then pass latitude and longitude with the event.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        date: { type: "string" },
        title: { type: "string" },
        startTime: { type: "string" },
        endTime: { type: "string" },
        category: { type: "string", enum: [...EVENT_CATEGORY_VALUES] },
        description: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        latitude: { type: ["number", "null"] },
        longitude: { type: ["number", "null"] },
        tip: { type: ["string", "null"] },
        cost: { type: ["number", "null"] },
        isBooked: { type: "boolean" },
      },
      required: [
        "date",
        "title",
        "startTime",
        "endTime",
        "category",
        "description",
        "location",
        "latitude",
        "longitude",
        "tip",
        "cost",
        "isBooked",
      ],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "set_day_itinerary",
    description:
      "Create or replace the timed events for a specific day when implementing a full itinerary. Use real named venues, restaurants, cafés, bakeries, attractions, and tours whenever the user asked you to research and fill out the day. If you do not already know the exact venue/address and coordinates for any location-bearing event, use web search first and then pass latitude and longitude for that event.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        date: { type: "string" },
        replaceExisting: { type: "boolean" },
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              startTime: { type: "string" },
              endTime: { type: "string" },
              category: { type: "string", enum: [...EVENT_CATEGORY_VALUES] },
              description: { type: ["string", "null"] },
              location: { type: ["string", "null"] },
              latitude: { type: ["number", "null"] },
              longitude: { type: ["number", "null"] },
              tip: { type: ["string", "null"] },
              cost: { type: ["number", "null"] },
              isBooked: { type: "boolean" },
            },
            required: [
              "title",
              "startTime",
              "endTime",
              "category",
              "description",
              "location",
              "latitude",
              "longitude",
              "tip",
              "cost",
              "isBooked",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["date", "replaceExisting", "events"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_event",
    description:
      "Update an existing event on the active trip using a known event ID. If you change or add a location and do not already know its exact coordinates, use web search first and then pass latitude and longitude.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        eventId: { type: "number" },
        title: { type: ["string", "null"] },
        startTime: { type: ["string", "null"] },
        endTime: { type: ["string", "null"] },
        category: { type: ["string", "null"], enum: [...EVENT_CATEGORY_VALUES, null] },
        description: { type: ["string", "null"] },
        location: { type: ["string", "null"] },
        latitude: { type: ["number", "null"] },
        longitude: { type: ["number", "null"] },
        tip: { type: ["string", "null"] },
        cost: { type: ["number", "null"] },
        isBooked: { type: ["boolean", "null"] },
      },
      required: [
        "eventId",
        "title",
        "startTime",
        "endTime",
        "category",
        "description",
        "location",
        "latitude",
        "longitude",
        "tip",
        "cost",
        "isBooked",
      ],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "delete_event",
    description: "Delete an event from the active trip.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        eventId: { type: "number" },
        reason: { type: "string" },
      },
      required: ["eventId", "reason"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_expense",
    description: "Create a budget line item on the active trip.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        category: { type: "string" },
        description: { type: "string" },
        amount: { type: "number" },
        isBooked: { type: "boolean" },
        isPaid: { type: "boolean" },
        purchaseDate: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        receiptUrl: { type: ["string", "null"] },
      },
      required: [
        "category",
        "description",
        "amount",
        "isBooked",
        "isPaid",
        "purchaseDate",
        "notes",
        "receiptUrl",
      ],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "set_budget_items",
    description:
      "Create or replace a full set of budget line items on the active trip. Use this when the user asks for a full budget, estimated costs, or wants the budget implemented into the site.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        replaceExisting: { type: "boolean" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              description: { type: "string" },
              amount: { type: "number" },
              isBooked: { type: "boolean" },
              isPaid: { type: "boolean" },
              purchaseDate: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
              receiptUrl: { type: ["string", "null"] },
            },
            required: [
              "category",
              "description",
              "amount",
              "isBooked",
              "isPaid",
              "purchaseDate",
              "notes",
              "receiptUrl",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["replaceExisting", "items"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_packing_item",
    description: "Add an item to the trip-wide or day-specific packing list.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        category: { type: "string" },
        name: { type: "string" },
        quantity: { type: "number" },
        isPacked: { type: "boolean" },
        isEssential: { type: "boolean" },
        dayDate: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
      },
      required: ["category", "name", "quantity", "isPacked", "isEssential", "dayDate", "notes"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "set_packing_list",
    description:
      "Create or replace a full packing list on the active trip. Use this when the user asks for a full packing list or wants the packing plan implemented into the site.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        replaceExisting: { type: "boolean" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              name: { type: "string" },
              quantity: { type: "number" },
              isPacked: { type: "boolean" },
              isEssential: { type: "boolean" },
              dayDate: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
            },
            required: [
              "category",
              "name",
              "quantity",
              "isPacked",
              "isEssential",
              "dayDate",
              "notes",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["replaceExisting", "items"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_reminder",
    description: "Create a reminder for the active trip.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: ["string", "null"] },
        dueDate: { type: ["string", "null"] },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        dayDate: { type: ["string", "null"] },
      },
      required: ["title", "body", "dueDate", "priority", "dayDate"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "update_list_items",
    description:
      "Check off, rename, re-price, or delete existing packing items, to-dos (reminders), and expenses by id. done means packed / completed / paid depending on kind. Pass null for fields you are not changing.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["packing", "todo", "expense"] },
              id: { type: "integer" },
              action: { type: "string", enum: ["update", "delete"] },
              done: { type: ["boolean", "null"] },
              title: { type: ["string", "null"] },
              amount: { type: ["number", "null"] },
            },
            required: ["kind", "id", "action", "done", "title", "amount"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "estimate_route",
    description: "Estimate travel time, distance, and timezone shift between two places before editing the itinerary.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
      },
      required: ["origin", "destination"],
      additionalProperties: false,
    },
  },
] as const;

function truncate(value: string, max = 60) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function cleanNullable(value: string | null) {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}


function formatHistoryTranscript(history: Awaited<ReturnType<typeof listAiMessages>>) {
  const lines = history.map((message) => {
      const attachments = getMessageAttachments(message.metadata);
      const attachmentLabel = attachments.length
        ? `\nAttached files: ${attachments.map((file) => file.filename).join(", ")}`
        : "";
      return `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}${attachmentLabel}`;
  });

  const kept: string[] = [];
  let total = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    total += lines[index].length + 1;
    if (total > MAX_HISTORY_CHARS) break;
    kept.unshift(lines[index]);
  }
  return kept.join("\n");
}





function getMessageAttachments(metadata: Record<string, unknown> | null | undefined) {
  const rawAttachments = metadata?.attachments;
  if (!Array.isArray(rawAttachments)) {
    return [];
  }

  const attachments: AiUploadedFile[] = [];
  for (const item of rawAttachments) {
    if (!item || typeof item !== "object") continue;
    const attachment = item as Partial<AiUploadedFile>;
    if (typeof attachment.filename !== "string") continue;

    attachments.push({
      fileId: attachment.fileId,
      fileData: attachment.fileData,
      filename: attachment.filename,
      mimeType:
        typeof attachment.mimeType === "string"
          ? attachment.mimeType
          : "application/octet-stream",
      bytes: typeof attachment.bytes === "number" ? attachment.bytes : 0,
    });
  }

  return attachments;
}

function collectConversationFiles(history: Awaited<ReturnType<typeof listAiMessages>>) {
  const seen = new Set<string>();
  const files: AiUploadedFile[] = [];

  for (const message of [...history].reverse()) {
    for (const file of getMessageAttachments(message.metadata)) {
      const key = file.fileId ?? file.fileData;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      files.push(file);
      if (files.length >= 8) {
        return files.reverse();
      }
    }
  }

  return files.reverse();
}

function buildSystemPrompt(input: { tripContext: AiTripContext }) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "You are Northstar, the planning assistant inside a trip planner. You work only on the current trip.",
    `Today is ${today}.`,
    "The trip JSON below is exactly what the user sees right now. Treat it as the source of truth over earlier chat messages.",
    "If the user asks a question, answer it directly and briefly. If the user asks for a change, make it with the tools, then reply in one or two short sentences saying what changed. Do not restate the whole plan.",
    "Every change you make is shown to the user as a list of changes with an Undo button, so act on clear requests without asking for confirmation.",
    "Ask a clarifying question only when a required detail is genuinely missing and no reasonable assumption exists.",
    "Stops are the events on each day. Each stop needs a specific real place name, a sensible time, the right category, and coordinates. Put helpful details (confirmation numbers, what to bring, tips) in the stop's tip field — that is the stop's notes.",
    `Use only these stop categories: ${EVENT_CATEGORY_VALUES.join(", ")}.`,
    "When you don't know a place's exact name, address, or coordinates, use web search first, then save the stop with latitude and longitude. Never save placeholders like 'Lunch nearby' when a real place can be found.",
    "For drive stops, save the destination as the location, not the route.",
    "When reshuffling a day, keep times realistic: use estimate_route for travel between places, leave time for meals, and respect fixed bookings (isBooked stops) and sunrise/sunset when relevant.",
    "To plan or rebuild a whole day, use set_day_itinerary. To change the trip's dates or number of days, use set_trip_structure first.",
    `Packing categories: ${PACKING_CATEGORY_VALUES.join(", ")}. Save full packing lists with set_packing_list and full budgets with set_budget_items rather than describing them in chat.`,
    "Use web search whenever freshness matters: hours, closures, permits, conditions, prices, events.",
    "Current trip JSON:",
    formatAiTripContext(input.tripContext),
  ].join("\n\n");
}

function shouldGroundAgainstCurrentState(currentMessage: string) {
  return /\b(change|update|edit|rename|adjust|revise|rewrite|reflect|sync|current|existing|now|site|website|schedule|day)\b/i.test(
    currentMessage
  );
}

function formatDayGroundingSummary(day: AiTripContext["days"][number]) {
  const eventLines = day.events.slice(0, 10).map((event) => {
    const timeLabel = [event.startTime, event.endTime].filter(Boolean).join("-");
    const locationLabel = event.location ? ` @ ${event.location}` : "";
    return `- ${timeLabel || "Time TBD"} · ${event.title}${locationLabel}`;
  });

  return [
    `Day ${day.dayNumber} (${day.date})`,
    `Current title: ${day.title}`,
    `Current location: ${day.location}`,
    `Current sleep location: ${day.sleepLocation ?? "None"}`,
    `Current drive info: ${day.driveInfo ?? "None"}`,
    `Current events (${day.events.length}):`,
    ...(eventLines.length ? eventLines : ["- No events currently scheduled"]),
  ].join("\n");
}

function buildCurrentStateGroundingNote(
  tripContext: AiTripContext,
  currentMessage: string
) {
  if (!shouldGroundAgainstCurrentState(currentMessage)) {
    return "";
  }

  const matchedDays = new Map<number, AiTripContext["days"][number]>();
  const dayNumberMatches = currentMessage.matchAll(/\bday\s+(\d{1,2})\b/gi);
  for (const match of dayNumberMatches) {
    const dayNumber = Number(match[1]);
    const day = tripContext.days.find((item) => item.dayNumber === dayNumber);
    if (day) {
      matchedDays.set(day.id, day);
    }
  }

  const dateMatches = currentMessage.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g);
  for (const match of dateMatches) {
    const day = tripContext.days.find((item) => item.date === match[0]);
    if (day) {
      matchedDays.set(day.id, day);
    }
  }

  const summaries = matchedDays.size
    ? [...matchedDays.values()].map(formatDayGroundingSummary)
    : [];

  return [
    "Use the current site state below as ground truth. Do not rely on prior chat memory when editing existing trip content.",
    ...(summaries.length ? summaries : []),
  ].join("\n\n");
}

function buildUserInputWithGrounding(
  history: Awaited<ReturnType<typeof listAiMessages>>,
  tripContext: AiTripContext,
  currentMessage: string,
  files: AiUploadedFile[] = []
) {
  const transcript = formatHistoryTranscript(history);
  const groundingNote = buildCurrentStateGroundingNote(tripContext, currentMessage);
  const text = [
    transcript ? `Conversation so far:\n${transcript}` : "",
    groundingNote,
    files.length
      ? `Files available for this turn:\n${files
          .map((file) => `- ${file.filename} (${file.mimeType}, ${file.bytes} bytes)`)
          .join("\n")}`
      : "",
    `Current user request:\n${currentMessage.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!files.length) {
    return text;
  }

  return [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text,
        },
        ...files.map((file) => ({
          type: "input_file",
          filename: file.filename,
          ...(file.fileId ? { file_id: file.fileId } : {}),
          ...(file.fileData ? { file_data: file.fileData } : {}),
        })),
      ],
    },
  ];
}

function buildMutationCard(title: string, changes: string[], description?: string | null): AiCard {
  return {
    type: "mutation",
    title,
    description: description ?? null,
    changes,
  };
}



async function getDayByDate(db: Db, tripId: number, date: string) {
  const day = await db.query.days.findFirst({
    where: and(eq(days.tripId, tripId), eq(days.date, date)),
  });

  if (!day) {
    throw new Error(`Day ${date} was not found on the active trip.`);
  }

  return day;
}

function buildEventSortOrder(index: number) {
  return (index + 1) * 100;
}

function normalizeEventCategory(category: string | null | undefined) {
  const trimmed = category?.trim().toLowerCase();
  if (!trimmed) return "other";
  if (CATEGORIES.includes(trimmed as (typeof CATEGORIES)[number])) {
    return trimmed;
  }

  if (
    /(restaurant|cafe|café|bakery|brunch|breakfast|lunch|dinner|food|gelato|coffee|pastry)/.test(
      trimmed
    )
  ) {
    return "food";
  }
  if (/(flight|airport|airline|terminal|boarding)/.test(trimmed)) {
    return "flight";
  }
  if (/(drive|transfer|train|transit|taxi|car|ferry|bus)/.test(trimmed)) {
    return "drive";
  }
  if (/(hotel|check-in|check in|stay|lodging|accommodation)/.test(trimmed)) {
    return "accommodation";
  }
  if (
    /(museum|tour|landmark|sight|gallery|church|cathedral|vatican|colosseum|palace|walk|visit)/.test(
      trimmed
    )
  ) {
    return "sightseeing";
  }
  if (/(shop|market|boutique)/.test(trimmed)) {
    return "shopping";
  }
  if (/(show|concert|opera|music|theater|theatre|club)/.test(trimmed)) {
    return "entertainment";
  }
  if (/(hike|trail|park|viewpoint)/.test(trimmed)) {
    return "hike";
  }

  return "other";
}

function normalizePackingCategory(category: string | null | undefined, name?: string | null) {
  const combined = `${category ?? ""} ${name ?? ""}`.trim().toLowerCase();
  if (!combined) return "other";

  if (/\b(passport|visa|id|license|boarding pass|ticket|insurance|document|wallet)\b/.test(combined)) {
    return "documents";
  }
  if (
    /\b(phone|charger|cable|adapter|battery pack|power bank|laptop|tablet|camera|earbuds|headphones|electronics?)\b/.test(
      combined
    )
  ) {
    return "electronics";
  }
  if (
    /\b(shirt|top|blouse|dress|pants|trouser|jeans|shorts|skirt|underwear|bra|sock|tights|sleepwear|pajama|jacket|coat|sweater|hoodie|blazer|cardigan|swimsuit|swim trunks|clothing|outfit)\b/.test(
      combined
    )
  ) {
    return "clothing";
  }
  if (/\b(shoes?|sneakers?|sandals?|boots?|heels?|loafers?|footwear)\b/.test(combined)) {
    return "footwear";
  }
  if (
    /\b(toothbrush|toothpaste|deodorant|shampoo|conditioner|soap|body wash|face wash|moisturizer|sunscreen|lip balm|razor|shaving|makeup|make-up|brush|comb|hair ties?|toiletr)\b/.test(
      combined
    )
  ) {
    return "toiletries";
  }
  if (
    /\b(medication|medicine|first aid|bandage|pain reliever|prescription|contact lenses?|solution|hygiene|tampon|pad|health)\b/.test(
      combined
    )
  ) {
    return "health";
  }
  if (
    /\b(sunglasses|jewelry|jewellery|watch|belt|hat|scarf|umbrella|accessor)\b/.test(combined)
  ) {
    return "accessories";
  }
  if (
    /\b(luggage|suitcase|backpack|day bag|crossbody|tote|packing cubes?|dry bag|lock|bag)\b/.test(
      combined
    )
  ) {
    return "bags";
  }
  if (/\b(beach|pool|towel|snorkel|cover-up|flip flops?)\b/.test(combined)) {
    return "beach";
  }
  if (/\b(snack|water bottle|food|gum|protein bar)\b/.test(combined)) {
    return "food";
  }

  return "other";
}

async function inferEventCoordinates(input: {
  title: string;
  category?: string | null;
  location: string | null;
  fallbackDayLocation: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<{
  lat: string | null;
  lng: string | null;
  location: string | null;
}> {
  if (input.latitude !== null && input.longitude !== null) {
    return {
      lat: String(input.latitude),
      lng: String(input.longitude),
      location: input.location ?? null,
    };
  }

  function extractDriveDestination(value: string | null | undefined) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return null;

    const arrowSegments = trimmed
      .split(/\s*(?:→|->|➡|⟶)\s*/g)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (arrowSegments.length >= 2) {
      return arrowSegments[arrowSegments.length - 1] ?? null;
    }

    const fromToMatch = trimmed.match(
      /\b(?:drive|trip|route|travel|head)\b.*?\bfrom\b\s+(.+?)\s+\bto\b\s+(.+)$/i
    );
    if (fromToMatch?.[2]) {
      return fromToMatch[2].trim();
    }

    const simpleToMatch = trimmed.match(/\bto\b\s+(.+)$/i);
    if (simpleToMatch?.[1]) {
      return simpleToMatch[1].trim();
    }

    return null;
  }

  const normalizedCategory = normalizeEventCategory(input.category);
  const rawLocation = cleanNullable(input.location);
  const location =
    normalizedCategory === "drive"
      ? extractDriveDestination(rawLocation) ?? extractDriveDestination(input.title) ?? rawLocation
      : rawLocation;

  async function geocodeFirstSuccessfulQuery(queries: Array<string | null | undefined>) {
    for (const rawQuery of queries) {
      const query = cleanNullable(rawQuery || "");
      if (!query) continue;

      try {
        return await geocodePlace(query);
      } catch {
        continue;
      }
    }

    return null;
  }

  if (location) {
    const geocoded = await geocodeFirstSuccessfulQuery([
      `${input.title}, ${location}`,
      `${location}, ${input.fallbackDayLocation}`,
      location,
    ]);

    if (!geocoded) {
      throw new Error(
        `Unable to resolve coordinates for "${location}". Use a specific named place or address.`
      );
    }

    return {
      lat: String(geocoded.lat),
      lng: String(geocoded.lng),
      location,
    };
  }

  const geocoded = await geocodeFirstSuccessfulQuery([
    `${input.title}, ${input.fallbackDayLocation}`,
    input.fallbackDayLocation,
  ]);

  if (geocoded) {
    return {
      lat: String(geocoded.lat),
      lng: String(geocoded.lng),
      location: geocoded.label,
    };
  }

  return {
    lat: null,
    lng: null,
    location: null,
  };
}

function normalizeTextForMatching(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEventIntentKey(input: {
  title: string;
  category: string;
}) {
  const search = `${input.title} ${input.category}`.toLowerCase();

  if (/(breakfast|croissant|pastry|boulangerie|brunch|cornetto)/.test(search)) {
    return "meal-breakfast";
  }
  if (/\blunch\b/.test(search)) {
    return "meal-lunch";
  }
  if (/\bdinner\b/.test(search)) {
    return "meal-dinner";
  }
  if (/(cafe|café|coffee|espresso|gelato|aperitivo)/.test(search)) {
    return "meal-cafe";
  }

  return normalizeTextForMatching(input.title);
}

function buildEventDuplicateKey(input: {
  title: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  location: string | null;
}) {
  const normalizedCategory = normalizeEventCategory(input.category);
  const intentKey = getEventIntentKey({
    title: input.title,
    category: normalizedCategory,
  });

  if (intentKey.startsWith("meal-")) {
    return [
      input.startTime ?? "",
      input.endTime ?? "",
      normalizedCategory,
      intentKey,
    ].join("::");
  }

  return [
    input.startTime ?? "",
    input.endTime ?? "",
    normalizedCategory,
    intentKey,
    normalizeTextForMatching(input.location),
  ].join("::");
}

function buildPackingDuplicateKey(input: {
  category: string;
  name: string;
  daySpecific: number | null;
}) {
  return [
    normalizeTextForMatching(normalizePackingCategory(input.category, input.name)),
    normalizeTextForMatching(input.name),
    String(input.daySpecific ?? ""),
  ].join("::");
}

function buildExpenseDuplicateKey(input: {
  category: string;
  description: string;
  amount: number | string;
  purchaseDate: string | null;
}) {
  return [
    normalizeTextForMatching(input.category),
    normalizeTextForMatching(input.description),
    String(input.amount),
    input.purchaseDate ?? "",
  ].join("::");
}

function snapshotTrip(trip: Trip) {
  return {
    name: trip.name,
    destination: trip.destination ?? null,
    summary: trip.summary ?? null,
    coverImageUrl: trip.coverImageUrl ?? null,
    startDate: trip.startDate ?? null,
    endDate: trip.endDate ?? null,
  };
}

function snapshotDay(day: typeof days.$inferSelect) {
  return {
    id: day.id,
    tripId: day.tripId,
    date: day.date,
    dayNumber: day.dayNumber,
    title: day.title,
    location: day.location,
    sleepLocation: day.sleepLocation ?? null,
    driveInfo: day.driveInfo ?? null,
    notes: day.notes ?? null,
    coverImageUrl: day.coverImageUrl ?? null,
  };
}

function snapshotEvent(event: typeof events.$inferSelect) {
  return {
    id: event.id,
    dayId: event.dayId,
    title: event.title,
    startTime: event.startTime ?? null,
    endTime: event.endTime ?? null,
    category: event.category,
    description: event.description ?? null,
    location: event.location ?? null,
    lat: event.lat ?? null,
    lng: event.lng ?? null,
    tip: event.tip ?? null,
    cost: event.cost ?? null,
    isBooked: event.isBooked ?? false,
    sortOrder: event.sortOrder ?? 0,
  };
}

function snapshotLocation(location: typeof locations.$inferSelect) {
  return {
    id: location.id,
    dayId: location.dayId,
    name: location.name,
    lat: location.lat,
    lng: location.lng,
    type: location.type,
    description: location.description ?? null,
    imageUrl: location.imageUrl ?? null,
    tip: location.tip ?? null,
    googleMapsUrl: location.googleMapsUrl ?? null,
  };
}

function snapshotPackingItem(item: typeof packingItems.$inferSelect) {
  return {
    tripId: item.tripId,
    category: item.category,
    name: item.name,
    quantity: item.quantity ?? 1,
    isPacked: item.isPacked ?? false,
    isEssential: item.isEssential ?? false,
    daySpecific: item.daySpecific ?? null,
    notes: item.notes ?? null,
  };
}

function snapshotExpense(expense: typeof expenses.$inferSelect) {
  return {
    tripId: expense.tripId,
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    isBooked: expense.isBooked ?? false,
    isPaid: expense.isPaid ?? false,
    purchaseDate: expense.purchaseDate ?? null,
    notes: expense.notes ?? null,
    receiptUrl: expense.receiptUrl ?? null,
  };
}

function extractMessageMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isMessageUndoable(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.undoable === true && metadata?.undoApplied !== true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function undoAiAssistantMessage(input: {
  db: Db;
  appUser: AppUser;
  activeTrip: Trip;
  conversationId: number;
  assistantMessageId: number;
}) {
  const assistantMessage = await getAiMessage(
    input.db,
    input.conversationId,
    input.assistantMessageId
  );

  if (!assistantMessage || assistantMessage.role !== "assistant") {
    throw new Error("Undo target was not found.");
  }

  if (!isMessageUndoable(assistantMessage.metadata)) {
    throw new Error("That AI response can no longer be undone.");
  }

  const sourceUserMessageId = extractMessageMetadataNumber(
    assistantMessage.metadata,
    "sourceUserMessageId"
  );
  if (!sourceUserMessageId) {
    throw new Error("Undo metadata is missing for that AI response.");
  }

  const actionLogs = await listAiActionLogsForMessage(
    input.db,
    input.conversationId,
    sourceUserMessageId
  );

  let revertedCount = 0;

  for (const log of actionLogs) {
    const details = log.details ?? null;

    switch (log.actionType) {
      case "update_trip_details": {
        const previous = asRecord(details?.previous);
        if (!previous) break;

        await input.db
          .update(trips)
          .set({
            name: typeof previous.name === "string" ? previous.name : input.activeTrip.name,
            destination:
              typeof previous.destination === "string" || previous.destination === null
                ? previous.destination
                : input.activeTrip.destination,
            summary:
              typeof previous.summary === "string" || previous.summary === null
                ? previous.summary
                : input.activeTrip.summary,
            coverImageUrl:
              typeof previous.coverImageUrl === "string" || previous.coverImageUrl === null
                ? previous.coverImageUrl
                : input.activeTrip.coverImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(trips.id, input.activeTrip.id));
        revertedCount += 1;
        break;
      }

      case "set_trip_structure": {
        const previousTrip = asRecord(details?.previousTrip);
        const previousDays = Array.isArray(details?.previousDays)
          ? details.previousDays
          : [];
        if (!previousTrip || !previousDays.length) break;

        await input.db.delete(days).where(eq(days.tripId, input.activeTrip.id));

        const previousDayRecords = previousDays
          .map(asRecord)
          .filter((day): day is Record<string, unknown> => Boolean(day));
        const dayIdMap = new Map<number, number>();

        for (const previousDay of previousDayRecords) {
          const oldDayId = Number(previousDay.id);
          const [restoredDay] = await input.db
            .insert(days)
            .values({
              id: oldDayId,
              tripId: input.activeTrip.id,
              date: String(previousDay.date),
              dayNumber: Number(previousDay.dayNumber),
              title: String(previousDay.title),
              location: String(previousDay.location),
              sleepLocation:
                typeof previousDay.sleepLocation === "string" ||
                previousDay.sleepLocation === null
                  ? previousDay.sleepLocation
                  : null,
              driveInfo:
                typeof previousDay.driveInfo === "string" || previousDay.driveInfo === null
                  ? previousDay.driveInfo
                  : null,
              notes:
                typeof previousDay.notes === "string" || previousDay.notes === null
                  ? previousDay.notes
                  : null,
              coverImageUrl:
                typeof previousDay.coverImageUrl === "string" ||
                previousDay.coverImageUrl === null
                  ? previousDay.coverImageUrl
                  : null,
            })
            .returning();

          if (restoredDay) {
            dayIdMap.set(oldDayId, restoredDay.id);
          }
        }

        const previousEvents = previousDayRecords.flatMap((day) =>
          Array.isArray(day.events) ? day.events : []
        );
        const eventValues = previousEvents
          .map(asRecord)
          .filter((event): event is Record<string, unknown> => Boolean(event))
          .flatMap((event) => {
            const dayId = dayIdMap.get(Number(event.dayId));
            if (!dayId) return [];
            return {
              id: Number(event.id),
              dayId,
              title: String(event.title),
              startTime: event.startTime ? String(event.startTime) : null,
              endTime: event.endTime ? String(event.endTime) : null,
              category: String(event.category),
              description:
                typeof event.description === "string" || event.description === null
                  ? event.description
                  : null,
              location:
                typeof event.location === "string" || event.location === null
                  ? event.location
                  : null,
              lat: typeof event.lat === "string" || event.lat === null ? event.lat : null,
              lng: typeof event.lng === "string" || event.lng === null ? event.lng : null,
              tip: typeof event.tip === "string" || event.tip === null ? event.tip : null,
              cost: typeof event.cost === "string" || event.cost === null ? event.cost : null,
              isBooked: typeof event.isBooked === "boolean" ? event.isBooked : false,
              sortOrder: typeof event.sortOrder === "number" ? event.sortOrder : 0,
            };
          });

        if (eventValues.length) {
          await input.db.insert(events).values(eventValues);
        }

        const previousLocations = previousDayRecords.flatMap((day) =>
          Array.isArray(day.locations) ? day.locations : []
        );
        const locationValues = previousLocations
          .map(asRecord)
          .filter((location): location is Record<string, unknown> => Boolean(location))
          .flatMap((location) => {
            const dayId = dayIdMap.get(Number(location.dayId));
            if (!dayId) return [];
            return {
              id: Number(location.id),
              dayId,
              name: String(location.name),
              lat: String(location.lat),
              lng: String(location.lng),
              type: String(location.type),
              description:
                typeof location.description === "string" || location.description === null
                  ? location.description
                  : null,
              imageUrl:
                typeof location.imageUrl === "string" || location.imageUrl === null
                  ? location.imageUrl
                  : null,
              tip:
                typeof location.tip === "string" || location.tip === null
                  ? location.tip
                  : null,
              googleMapsUrl:
                typeof location.googleMapsUrl === "string" ||
                location.googleMapsUrl === null
                  ? location.googleMapsUrl
                  : null,
            };
          });

        if (locationValues.length) {
          await input.db.insert(locations).values(locationValues);
        }

        await input.db
          .update(trips)
          .set({
            name: typeof previousTrip.name === "string" ? previousTrip.name : input.activeTrip.name,
            destination:
              typeof previousTrip.destination === "string" ||
              previousTrip.destination === null
                ? previousTrip.destination
                : input.activeTrip.destination,
            summary:
              typeof previousTrip.summary === "string" || previousTrip.summary === null
                ? previousTrip.summary
                : input.activeTrip.summary,
            coverImageUrl:
              typeof previousTrip.coverImageUrl === "string" ||
              previousTrip.coverImageUrl === null
                ? previousTrip.coverImageUrl
                : input.activeTrip.coverImageUrl,
            startDate:
              typeof previousTrip.startDate === "string" || previousTrip.startDate === null
                ? previousTrip.startDate
                : input.activeTrip.startDate,
            endDate:
              typeof previousTrip.endDate === "string" || previousTrip.endDate === null
                ? previousTrip.endDate
                : input.activeTrip.endDate,
            updatedAt: new Date(),
          })
          .where(eq(trips.id, input.activeTrip.id));

        revertedCount += 1;
        break;
      }

      case "update_day_details": {
        const dayId = typeof details?.dayId === "number" ? details.dayId : null;
        const previous = asRecord(details?.previous);
        if (!dayId || !previous) break;

        await input.db
          .update(days)
          .set({
            title: typeof previous.title === "string" ? previous.title : undefined,
            location: typeof previous.location === "string" ? previous.location : undefined,
            sleepLocation:
              typeof previous.sleepLocation === "string" || previous.sleepLocation === null
                ? previous.sleepLocation
                : undefined,
            driveInfo:
              typeof previous.driveInfo === "string" || previous.driveInfo === null
                ? previous.driveInfo
                : undefined,
            notes:
              typeof previous.notes === "string" || previous.notes === null
                ? previous.notes
                : undefined,
            coverImageUrl:
              typeof previous.coverImageUrl === "string" || previous.coverImageUrl === null
                ? previous.coverImageUrl
                : undefined,
          })
          .where(eq(days.id, dayId));
        revertedCount += 1;
        break;
      }

      case "create_event": {
        const eventId = typeof details?.createdEventId === "number" ? details.createdEventId : null;
        if (!eventId) break;
        await input.db.delete(events).where(eq(events.id, eventId));
        revertedCount += 1;
        break;
      }

      case "set_day_itinerary": {
        const insertedEventIds = Array.isArray(details?.insertedEventIds)
          ? details.insertedEventIds.filter(
              (value): value is number => typeof value === "number" && Number.isFinite(value)
            )
          : [];
        const previousEvents = Array.isArray(details?.previousEvents)
          ? details.previousEvents
          : [];

        for (const eventId of insertedEventIds) {
          await input.db.delete(events).where(eq(events.id, eventId));
        }

        if (previousEvents.length) {
          await input.db.insert(events).values(
            previousEvents
              .map(asRecord)
              .filter((event): event is Record<string, unknown> => Boolean(event))
              .map((event) => ({
                dayId: Number(event.dayId),
                title: String(event.title),
                startTime: event.startTime ? String(event.startTime) : null,
                endTime: event.endTime ? String(event.endTime) : null,
                category: String(event.category),
                description:
                  typeof event.description === "string" || event.description === null
                    ? event.description
                    : null,
                location:
                  typeof event.location === "string" || event.location === null
                    ? event.location
                    : null,
                lat: typeof event.lat === "string" || event.lat === null ? event.lat : null,
                lng: typeof event.lng === "string" || event.lng === null ? event.lng : null,
                tip: typeof event.tip === "string" || event.tip === null ? event.tip : null,
                cost: typeof event.cost === "string" || event.cost === null ? event.cost : null,
                isBooked: typeof event.isBooked === "boolean" ? event.isBooked : false,
                sortOrder: typeof event.sortOrder === "number" ? event.sortOrder : 0,
              }))
          );
        }

        if (insertedEventIds.length || previousEvents.length) {
          revertedCount += 1;
        }
        break;
      }

      case "update_event": {
        const eventId = typeof details?.eventId === "number" ? details.eventId : null;
        const previous = asRecord(details?.previous);
        if (!eventId || !previous) break;

        await input.db
          .update(events)
          .set({
            title: typeof previous.title === "string" ? previous.title : undefined,
            startTime:
              typeof previous.startTime === "string" || previous.startTime === null
                ? previous.startTime
                : undefined,
            endTime:
              typeof previous.endTime === "string" || previous.endTime === null
                ? previous.endTime
                : undefined,
            category: typeof previous.category === "string" ? previous.category : undefined,
            description:
              typeof previous.description === "string" || previous.description === null
                ? previous.description
                : undefined,
            location:
              typeof previous.location === "string" || previous.location === null
                ? previous.location
                : undefined,
            lat: typeof previous.lat === "string" || previous.lat === null ? previous.lat : undefined,
            lng: typeof previous.lng === "string" || previous.lng === null ? previous.lng : undefined,
            tip: typeof previous.tip === "string" || previous.tip === null ? previous.tip : undefined,
            cost:
              typeof previous.cost === "string" || previous.cost === null ? previous.cost : undefined,
            isBooked: typeof previous.isBooked === "boolean" ? previous.isBooked : undefined,
            sortOrder: typeof previous.sortOrder === "number" ? previous.sortOrder : undefined,
            updatedAt: new Date(),
          })
          .where(eq(events.id, eventId));
        revertedCount += 1;
        break;
      }

      case "delete_event": {
        const deletedEvent = asRecord(details?.deletedEvent);
        if (!deletedEvent) break;

        await input.db.insert(events).values({
          dayId: Number(deletedEvent.dayId),
          title: String(deletedEvent.title),
          startTime: deletedEvent.startTime ? String(deletedEvent.startTime) : null,
          endTime: deletedEvent.endTime ? String(deletedEvent.endTime) : null,
          category: String(deletedEvent.category),
          description:
            typeof deletedEvent.description === "string" || deletedEvent.description === null
              ? deletedEvent.description
              : null,
          location:
            typeof deletedEvent.location === "string" || deletedEvent.location === null
              ? deletedEvent.location
              : null,
          lat:
            typeof deletedEvent.lat === "string" || deletedEvent.lat === null
              ? deletedEvent.lat
              : null,
          lng:
            typeof deletedEvent.lng === "string" || deletedEvent.lng === null
              ? deletedEvent.lng
              : null,
          tip:
            typeof deletedEvent.tip === "string" || deletedEvent.tip === null
              ? deletedEvent.tip
              : null,
          cost:
            typeof deletedEvent.cost === "string" || deletedEvent.cost === null
              ? deletedEvent.cost
              : null,
          isBooked: typeof deletedEvent.isBooked === "boolean" ? deletedEvent.isBooked : false,
          sortOrder: typeof deletedEvent.sortOrder === "number" ? deletedEvent.sortOrder : 0,
        });
        revertedCount += 1;
        break;
      }

      case "create_expense": {
        const expenseId = typeof details?.createdExpenseId === "number" ? details.createdExpenseId : null;
        if (!expenseId) break;
        await input.db.delete(expenses).where(eq(expenses.id, expenseId));
        revertedCount += 1;
        break;
      }

      case "set_budget_items": {
        const insertedExpenseIds = Array.isArray(details?.insertedExpenseIds)
          ? details.insertedExpenseIds.filter(
              (value): value is number => typeof value === "number" && Number.isFinite(value)
            )
          : [];
        const previousExpenses = Array.isArray(details?.previousExpenses)
          ? details.previousExpenses
          : [];

        for (const expenseId of insertedExpenseIds) {
          await input.db.delete(expenses).where(eq(expenses.id, expenseId));
        }

        if (previousExpenses.length) {
          await input.db.insert(expenses).values(
            previousExpenses
              .map(asRecord)
              .filter((expense): expense is Record<string, unknown> => Boolean(expense))
              .map((expense) => ({
                tripId: Number(expense.tripId),
                category: String(expense.category),
                description: String(expense.description),
                amount: String(expense.amount),
                isBooked: typeof expense.isBooked === "boolean" ? expense.isBooked : false,
                isPaid: typeof expense.isPaid === "boolean" ? expense.isPaid : false,
                purchaseDate:
                  typeof expense.purchaseDate === "string" || expense.purchaseDate === null
                    ? expense.purchaseDate
                    : null,
                notes:
                  typeof expense.notes === "string" || expense.notes === null ? expense.notes : null,
                receiptUrl:
                  typeof expense.receiptUrl === "string" || expense.receiptUrl === null
                    ? expense.receiptUrl
                    : null,
              }))
          );
        }

        if (insertedExpenseIds.length || previousExpenses.length) {
          revertedCount += 1;
        }
        break;
      }

      case "create_packing_item": {
        const packingItemId =
          typeof details?.createdPackingItemId === "number" ? details.createdPackingItemId : null;
        if (!packingItemId) break;
        await input.db.delete(packingItems).where(eq(packingItems.id, packingItemId));
        revertedCount += 1;
        break;
      }

      case "set_packing_list": {
        const insertedPackingItemIds = Array.isArray(details?.insertedPackingItemIds)
          ? details.insertedPackingItemIds.filter(
              (value): value is number => typeof value === "number" && Number.isFinite(value)
            )
          : [];
        const previousPackingItems = Array.isArray(details?.previousPackingItems)
          ? details.previousPackingItems
          : [];

        for (const packingItemId of insertedPackingItemIds) {
          await input.db.delete(packingItems).where(eq(packingItems.id, packingItemId));
        }

        if (previousPackingItems.length) {
          await input.db.insert(packingItems).values(
            previousPackingItems
              .map(asRecord)
              .filter((item): item is Record<string, unknown> => Boolean(item))
              .map((item) => ({
                tripId: Number(item.tripId),
                category: String(item.category),
                name: String(item.name),
                quantity: typeof item.quantity === "number" ? item.quantity : 1,
                isPacked: typeof item.isPacked === "boolean" ? item.isPacked : false,
                isEssential: typeof item.isEssential === "boolean" ? item.isEssential : false,
                daySpecific:
                  typeof item.daySpecific === "number" || item.daySpecific === null
                    ? item.daySpecific
                    : null,
                notes:
                  typeof item.notes === "string" || item.notes === null ? item.notes : null,
              }))
          );
        }

        if (insertedPackingItemIds.length || previousPackingItems.length) {
          revertedCount += 1;
        }
        break;
      }

      case "create_reminder": {
        const reminderId =
          typeof details?.createdReminderId === "number" ? details.createdReminderId : null;
        if (!reminderId) break;
        await input.db.delete(reminders).where(eq(reminders.id, reminderId));
        revertedCount += 1;
        break;
      }

      case "update_list_items": {
        const changes = Array.isArray(details?.changes) ? details.changes : [];
        for (const raw of [...changes].reverse()) {
          const change = asRecord(raw);
          const previous = asRecord(change?.previous);
          if (!change || !previous) continue;
          const id = Number(change.id);
          if (change.kind === "packing") {
            const values = {
              tripId: Number(previous.tripId),
              category: String(previous.category),
              name: String(previous.name),
              quantity: typeof previous.quantity === "number" ? previous.quantity : 1,
              isPacked: Boolean(previous.isPacked),
              isEssential: Boolean(previous.isEssential),
              daySpecific: typeof previous.daySpecific === "number" ? previous.daySpecific : null,
              notes: typeof previous.notes === "string" ? previous.notes : null,
            };
            if (change.action === "delete") await input.db.insert(packingItems).values({ id, ...values });
            else await input.db.update(packingItems).set(values).where(eq(packingItems.id, id));
          } else if (change.kind === "todo") {
            const values = {
              tripId: Number(previous.tripId),
              title: String(previous.title),
              body: typeof previous.body === "string" ? previous.body : null,
              dueDate: typeof previous.dueDate === "string" ? previous.dueDate : null,
              isDone: Boolean(previous.isDone),
              priority: typeof previous.priority === "string" ? previous.priority : "medium",
              dayId: typeof previous.dayId === "number" ? previous.dayId : null,
            };
            if (change.action === "delete") await input.db.insert(reminders).values({ id, ...values });
            else await input.db.update(reminders).set(values).where(eq(reminders.id, id));
          } else if (change.kind === "expense") {
            const values = {
              tripId: Number(previous.tripId),
              category: String(previous.category),
              description: String(previous.description),
              amount: String(previous.amount),
              isBooked: Boolean(previous.isBooked),
              isPaid: Boolean(previous.isPaid),
              purchaseDate: typeof previous.purchaseDate === "string" ? previous.purchaseDate : null,
              receiptUrl: typeof previous.receiptUrl === "string" ? previous.receiptUrl : null,
              notes: typeof previous.notes === "string" ? previous.notes : null,
            };
            if (change.action === "delete") await input.db.insert(expenses).values({ id, ...values });
            else await input.db.update(expenses).set(values).where(eq(expenses.id, id));
          }
        }
        if (changes.length) revertedCount += 1;
        break;
      }

      case "create_location": {
        const locationId =
          typeof details?.createdLocationId === "number" ? details.createdLocationId : null;
        if (!locationId) break;
        await input.db.delete(locations).where(eq(locations.id, locationId));
        revertedCount += 1;
        break;
      }

      case "update_location": {
        const locationId = typeof details?.locationId === "number" ? details.locationId : null;
        const previous = asRecord(details?.previous);
        if (!locationId || !previous) break;

        await input.db
          .update(locations)
          .set({
            name: typeof previous.name === "string" ? previous.name : undefined,
            lat: typeof previous.lat === "string" ? previous.lat : undefined,
            lng: typeof previous.lng === "string" ? previous.lng : undefined,
            type: typeof previous.type === "string" ? previous.type : undefined,
            description:
              typeof previous.description === "string" || previous.description === null
                ? previous.description
                : undefined,
            imageUrl:
              typeof previous.imageUrl === "string" || previous.imageUrl === null
                ? previous.imageUrl
                : undefined,
            tip:
              typeof previous.tip === "string" || previous.tip === null ? previous.tip : undefined,
            googleMapsUrl:
              typeof previous.googleMapsUrl === "string" || previous.googleMapsUrl === null
                ? previous.googleMapsUrl
                : undefined,
          })
          .where(eq(locations.id, locationId));
        revertedCount += 1;
        break;
      }

      case "delete_location": {
        const deletedLocation = asRecord(details?.deletedLocation);
        if (!deletedLocation) break;

        await input.db.insert(locations).values({
          dayId: Number(deletedLocation.dayId),
          name: String(deletedLocation.name),
          lat: String(deletedLocation.lat),
          lng: String(deletedLocation.lng),
          type: String(deletedLocation.type),
          description:
            typeof deletedLocation.description === "string" || deletedLocation.description === null
              ? deletedLocation.description
              : null,
          imageUrl:
            typeof deletedLocation.imageUrl === "string" || deletedLocation.imageUrl === null
              ? deletedLocation.imageUrl
              : null,
          tip:
            typeof deletedLocation.tip === "string" || deletedLocation.tip === null
              ? deletedLocation.tip
              : null,
          googleMapsUrl:
            typeof deletedLocation.googleMapsUrl === "string" ||
            deletedLocation.googleMapsUrl === null
              ? deletedLocation.googleMapsUrl
              : null,
        });
        revertedCount += 1;
        break;
      }
    }
  }

  if (!revertedCount) {
    throw new Error("There were no reversible changes attached to that response.");
  }

  await touchTrip(input.db, input.activeTrip.id);
  revalidateTripViews();

  const metadata = {
    ...(assistantMessage.metadata ?? {}),
    undoApplied: true,
    undoneAt: new Date().toISOString(),
  };
  const updatedMessage = await updateAiMessageMetadata(
    input.db,
    assistantMessage.id,
    metadata
  );

  await createAiActionLog(input.db, {
    userId: input.appUser.id,
    tripId: input.activeTrip.id,
    conversationId: input.conversationId,
    messageId: assistantMessage.id,
    actionType: "undo_ai_turn",
    summary: `Undid ${revertedCount} AI change${revertedCount === 1 ? "" : "s"}.`,
    details: {
      assistantMessageId: assistantMessage.id,
      sourceUserMessageId,
      revertedCount,
    },
  });

  return {
    message: updatedMessage ?? assistantMessage,
    revertedCount,
    summary: `Undid ${revertedCount} AI change${revertedCount === 1 ? "" : "s"}.`,
  };
}

async function executeToolCall(input: {
  db: Db;
  appUser: AppUser;
  activeTrip: Trip;
  conversationId: number;
  userMessageId: number;
  tripContext: AiTripContext;
  toolName: keyof typeof toolValidators;
  rawArguments: string;
}): Promise<ToolExecutionArtifact> {
  const rawArguments = JSON.parse(input.rawArguments || "{}");

  switch (input.toolName) {
    case "update_trip_details": {
      const parsedArgs = toolValidators.update_trip_details.parse(rawArguments);
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      const changes: string[] = [];

      const name = cleanNullable(parsedArgs.name);
      const destination = cleanNullable(parsedArgs.destination);
      const summary = cleanNullable(parsedArgs.summary);
      const coverImageUrl = cleanNullable(parsedArgs.coverImageUrl);

      if (name !== undefined) {
        updates.name = name || input.activeTrip.name;
        changes.push(`Set trip name to "${updates.name}".`);
      }
      if (destination !== undefined) {
        updates.destination = destination;
        changes.push(destination ? `Set destination to ${destination}.` : "Cleared the destination.");
      }
      if (summary !== undefined) {
        updates.summary = summary;
        changes.push(summary ? "Updated the trip summary." : "Cleared the trip summary.");
      }
      if (coverImageUrl !== undefined) {
        updates.coverImageUrl = coverImageUrl;
        changes.push(
          coverImageUrl ? "Updated the trip cover image." : "Removed the trip cover image."
        );
      }

      if (changes.length) {
        await input.db.update(trips).set(updates).where(eq(trips.id, input.activeTrip.id));
        await touchTrip(input.db, input.activeTrip.id);
        revalidateTripViews();
      }

      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "update_trip_details",
        summary: changes.join(" "),
        details: {
          updates,
          previous: snapshotTrip(input.activeTrip),
        },
      });

      return {
        output: { success: true, changes },
        summary: changes.join(" ") || "No trip-level changes were needed.",
        cards: changes.length
          ? [buildMutationCard("Updated trip details", changes)]
          : [],
        undoable: changes.length > 0,
      };
    }

    case "set_trip_structure": {
      const parsedArgs = toolValidators.set_trip_structure.parse(rawArguments);
      const previousTrip = snapshotTrip(input.activeTrip);
      const previousDayRows = await input.db.query.days.findMany({
        where: eq(days.tripId, input.activeTrip.id),
        with: {
          events: true,
          locations: true,
        },
      });
      const previousDays = previousDayRows
        .sort((a, b) => a.dayNumber - b.dayNumber || a.date.localeCompare(b.date))
        .map((day) => ({
          ...snapshotDay(day),
          events: day.events.map(snapshotEvent),
          locations: day.locations.map(snapshotLocation),
        }));

      const updatedDays = await updateTripDates(
        input.activeTrip.id,
        parsedArgs.startDate,
        parsedArgs.days.length
      );
      const sortedUpdatedDays = [...updatedDays].sort(
        (a, b) => a.dayNumber - b.dayNumber || a.date.localeCompare(b.date)
      );
      const updatedDayIds = sortedUpdatedDays.map((day) => day.id);

      if (parsedArgs.replaceExisting && updatedDayIds.length) {
        await input.db.delete(locations).where(inArray(locations.dayId, updatedDayIds));
        await input.db.delete(events).where(inArray(events.dayId, updatedDayIds));
      }

      for (const [index, dayInput] of parsedArgs.days.entries()) {
        const day = sortedUpdatedDays[index];
        if (!day) continue;

        await input.db
          .update(days)
          .set({
            title: dayInput.title,
            location: dayInput.location,
            sleepLocation: cleanNullable(dayInput.sleepLocation) ?? null,
            driveInfo: cleanNullable(dayInput.driveInfo) ?? null,
            notes: cleanNullable(dayInput.notes) ?? null,
            coverImageUrl: cleanNullable(dayInput.coverImageUrl) ?? null,
          })
          .where(eq(days.id, day.id));
      }

      const tripUpdates: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      const name = cleanNullable(parsedArgs.name);
      const destination = cleanNullable(parsedArgs.destination);
      const summary = cleanNullable(parsedArgs.summary);

      if (name !== undefined) {
        tripUpdates.name = name || input.activeTrip.name;
      }
      if (destination !== undefined) {
        tripUpdates.destination = destination;
      }
      if (summary !== undefined) {
        tripUpdates.summary = summary;
      }

      if (Object.keys(tripUpdates).length > 1) {
        await input.db.update(trips).set(tripUpdates).where(eq(trips.id, input.activeTrip.id));
      }

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const changes = [
        `Set trip to ${parsedArgs.days.length} day${parsedArgs.days.length === 1 ? "" : "s"} starting ${parsedArgs.startDate}.`,
        parsedArgs.replaceExisting
          ? "Cleared existing events and map pins from the rebuilt days."
          : "Kept existing day content where possible.",
        ...parsedArgs.days.map(
          (day, index) => `Day ${index + 1}: ${day.title} (${day.location})`
        ),
      ];
      const summaryText = `Rebuilt the trip structure with ${parsedArgs.days.length} day${parsedArgs.days.length === 1 ? "" : "s"} starting ${parsedArgs.startDate}.`;

      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "set_trip_structure",
        summary: summaryText,
        details: {
          previousTrip,
          previousDays,
          replaceExisting: parsedArgs.replaceExisting,
        },
      });

      return {
        output: {
          success: true,
          dayCount: parsedArgs.days.length,
          startDate: parsedArgs.startDate,
          replaceExisting: parsedArgs.replaceExisting,
        },
        summary: summaryText,
        cards: [buildMutationCard("Rebuilt trip structure", changes)],
        undoable: true,
      };
    }

    case "update_day_details": {
      const parsedArgs = toolValidators.update_day_details.parse(rawArguments);
      const day = await getDayByDate(input.db, input.activeTrip.id, parsedArgs.date);
      const updates: Record<string, unknown> = {};
      const changes: string[] = [];

      const title = cleanNullable(parsedArgs.title);
      const location = cleanNullable(parsedArgs.location);
      const sleepLocation = cleanNullable(parsedArgs.sleepLocation);
      const driveInfo = cleanNullable(parsedArgs.driveInfo);
      const notes = cleanNullable(parsedArgs.notes);
      const coverImageUrl = cleanNullable(parsedArgs.coverImageUrl);

      if (title !== undefined) {
        updates.title = title || day.title;
        changes.push(`Updated ${parsedArgs.date} title to "${updates.title}".`);
      }
      if (location !== undefined) {
        updates.location = location || day.location;
        changes.push(`Updated ${parsedArgs.date} location to "${updates.location}".`);
      }
      if (sleepLocation !== undefined) {
        updates.sleepLocation = sleepLocation;
        changes.push(
          sleepLocation
            ? `Set ${parsedArgs.date} sleep location to ${sleepLocation}.`
            : `Cleared ${parsedArgs.date} sleep location.`
        );
      }
      if (driveInfo !== undefined) {
        updates.driveInfo = driveInfo;
        changes.push(
          driveInfo ? `Updated ${parsedArgs.date} drive info.` : `Cleared ${parsedArgs.date} drive info.`
        );
      }
      if (notes !== undefined) {
        updates.notes = notes;
        changes.push(notes ? `Updated ${parsedArgs.date} notes.` : `Cleared ${parsedArgs.date} notes.`);
      }
      if (coverImageUrl !== undefined) {
        updates.coverImageUrl = coverImageUrl;
        changes.push(
          coverImageUrl
            ? `Updated ${parsedArgs.date} cover image.`
            : `Removed ${parsedArgs.date} cover image.`
        );
      }

      if (changes.length) {
        await input.db.update(days).set(updates).where(eq(days.id, day.id));
        await touchTrip(input.db, input.activeTrip.id);
        revalidateTripViews();
      }

      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "update_day_details",
        summary: changes.join(" "),
        details: { dayId: day.id, updates, previous: snapshotDay(day) },
      });

      return {
        output: { success: true, dayId: day.id, changes },
        summary: changes.join(" ") || `No updates were needed for ${parsedArgs.date}.`,
        cards: changes.length
          ? [buildMutationCard(`Updated day ${day.dayNumber}`, changes, day.title)]
          : [],
        undoable: changes.length > 0,
      };
    }

    case "create_event": {
      const parsedArgs = toolValidators.create_event.parse(rawArguments);
      const day = await getDayByDate(input.db, input.activeTrip.id, parsedArgs.date);
      const existingDayEvents = await input.db.query.events.findMany({
        where: eq(events.dayId, day.id),
      });
      const resolvedCoordinates = await inferEventCoordinates({
        title: parsedArgs.title,
        category: parsedArgs.category,
        location: cleanNullable(parsedArgs.location) ?? null,
        fallbackDayLocation: day.location,
        latitude: parsedArgs.latitude,
        longitude: parsedArgs.longitude,
      });
      const duplicateKey = buildEventDuplicateKey({
        title: parsedArgs.title,
        startTime: parsedArgs.startTime,
        endTime: parsedArgs.endTime,
        category: parsedArgs.category,
        location: resolvedCoordinates.location,
      });
      const duplicateEvent = existingDayEvents.find(
        (event) =>
          buildEventDuplicateKey({
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            category: event.category,
            location: event.location,
          }) === duplicateKey
      );

      if (duplicateEvent) {
        return {
          output: {
            skipped: true,
            reason: "duplicate_event",
            eventId: duplicateEvent.id,
          },
          summary: `Skipped duplicate event "${parsedArgs.title}" on ${parsedArgs.date}.`,
        };
      }
      // Slot the new stop chronologically among the day's existing stops.
      const ordered = [...existingDayEvents].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.startTime ?? "").localeCompare(b.startTime ?? "")
      );
      const insertAt = parsedArgs.startTime
        ? ordered.findIndex((event) => event.startTime !== null && event.startTime > parsedArgs.startTime)
        : -1;
      const position = insertAt === -1 ? ordered.length : insertAt;
      for (const [index, event] of ordered.entries()) {
        const nextOrder = index < position ? index : index + 1;
        if ((event.sortOrder ?? 0) !== nextOrder) {
          await input.db.update(events).set({ sortOrder: nextOrder }).where(eq(events.id, event.id));
        }
      }
      const [created] = await input.db
        .insert(events)
        .values({
          dayId: day.id,
          title: parsedArgs.title,
          startTime: parsedArgs.startTime,
          endTime: parsedArgs.endTime,
          category: normalizeEventCategory(parsedArgs.category),
          description: cleanNullable(parsedArgs.description) ?? null,
          location: resolvedCoordinates.location,
          lat: resolvedCoordinates.lat,
          lng: resolvedCoordinates.lng,
          tip: cleanNullable(parsedArgs.tip) ?? null,
          cost: parsedArgs.cost === null ? null : String(parsedArgs.cost),
          isBooked: parsedArgs.isBooked,
          sortOrder: position,
        })
        .returning();

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const summary = `Added ${parsedArgs.title} to ${parsedArgs.date} from ${parsedArgs.startTime} to ${parsedArgs.endTime}.`;
      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "create_event",
        summary,
        details: {
          createdEventId: created.id,
          event: snapshotEvent(created),
        },
      });

      return {
        output: created,
        summary,
        cards: [
          buildMutationCard("Added itinerary event", [
            `Added "${parsedArgs.title}" on ${parsedArgs.date}.`,
            `Scheduled it for ${parsedArgs.startTime}-${parsedArgs.endTime}.`,
            resolvedCoordinates.location
              ? `Mapped it to ${resolvedCoordinates.location}.`
              : "No mappable location was available for this event.",
          ]),
        ],
        undoable: true,
      };
    }

    case "set_day_itinerary": {
      const parsedArgs = toolValidators.set_day_itinerary.parse(rawArguments);
      const day = await getDayByDate(input.db, input.activeTrip.id, parsedArgs.date);

      const existingDayEvents = await input.db.query.events.findMany({
        where: eq(events.dayId, day.id),
        orderBy: [events.sortOrder, events.startTime],
      });
      const previousEvents = parsedArgs.replaceExisting
        ? existingDayEvents.map(snapshotEvent)
        : [];

      const seenDuplicateKeys = new Set(
        parsedArgs.replaceExisting
          ? []
          : existingDayEvents.map((event) =>
              buildEventDuplicateKey({
                title: event.title,
                startTime: event.startTime,
                endTime: event.endTime,
                category: event.category,
                location: event.location,
              })
            )
      );
      const skippedDuplicates: string[] = [];

      const normalizedEventsRaw = await Promise.all(
        parsedArgs.events.map(async (event, index) => {
          const resolvedCoordinates = await inferEventCoordinates({
            title: event.title,
            category: event.category,
            location: cleanNullable(event.location) ?? null,
            fallbackDayLocation: day.location,
            latitude: event.latitude,
            longitude: event.longitude,
          });

          const duplicateKey = buildEventDuplicateKey({
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            category: event.category,
            location: resolvedCoordinates.location,
          });

          if (seenDuplicateKeys.has(duplicateKey)) {
            skippedDuplicates.push(`${event.startTime}-${event.endTime} · ${event.title}`);
            return null;
          }

          seenDuplicateKeys.add(duplicateKey);

          return {
            dayId: day.id,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            category: normalizeEventCategory(event.category),
            description: cleanNullable(event.description) ?? null,
            location: resolvedCoordinates.location,
            lat: resolvedCoordinates.lat,
            lng: resolvedCoordinates.lng,
            tip: cleanNullable(event.tip) ?? null,
            cost: event.cost === null ? null : String(event.cost),
            isBooked: event.isBooked,
            sortOrder: buildEventSortOrder(index),
          };
        })
      );
      const normalizedEvents = normalizedEventsRaw.filter(
        (
          event
        ): event is Exclude<(typeof normalizedEventsRaw)[number], null> => event !== null
      );

      if (parsedArgs.replaceExisting && existingDayEvents.length) {
        await input.db.delete(events).where(eq(events.dayId, day.id));
      }

      const inserted = normalizedEvents.length
        ? await input.db.insert(events).values(normalizedEvents).returning()
        : [];

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const changes = [
        parsedArgs.replaceExisting && existingDayEvents.length
          ? `Replaced ${existingDayEvents.length} existing event${existingDayEvents.length === 1 ? "" : "s"} on ${parsedArgs.date}.`
          : `Added a timed itinerary for ${parsedArgs.date}.`,
        ...inserted.map(
          (event) =>
            `${event.startTime ?? "Time TBD"}-${event.endTime ?? "Time TBD"} · ${event.title}${event.location ? ` @ ${event.location}` : ""}`
        ),
        ...skippedDuplicates.map((eventLabel) => `Skipped duplicate: ${eventLabel}`),
      ];
      const summary = `Applied ${inserted.length} timed event${inserted.length === 1 ? "" : "s"} to ${parsedArgs.date}.${skippedDuplicates.length ? ` Skipped ${skippedDuplicates.length} duplicate${skippedDuplicates.length === 1 ? "" : "s"}.` : ""}`;

      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "set_day_itinerary",
        summary,
        details: {
          dayId: day.id,
          replaceExisting: parsedArgs.replaceExisting,
          previousEvents,
          insertedEventIds: inserted.map((event) => event.id),
        },
      });

      return {
        output: {
          dayId: day.id,
          eventCount: inserted.length,
          replacedExisting: parsedArgs.replaceExisting,
        },
        summary,
        cards: [buildMutationCard(`Applied itinerary to day ${day.dayNumber}`, changes, day.title)],
        undoable: inserted.length > 0 || previousEvents.length > 0,
      };
    }

    case "update_event": {
      const parsedArgs = toolValidators.update_event.parse(rawArguments);
      const event = await input.db.query.events.findFirst({
        where: eq(events.id, parsedArgs.eventId),
        with: { day: true },
      });
      if (!event || event.day.tripId !== input.activeTrip.id) {
        throw new Error("Event not found on the active trip.");
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      const changes: string[] = [];

      const title = cleanNullable(parsedArgs.title);
      const startTime = cleanNullable(parsedArgs.startTime);
      const endTime = cleanNullable(parsedArgs.endTime);
      const category = cleanNullable(parsedArgs.category);
      const description = cleanNullable(parsedArgs.description);
      const location = cleanNullable(parsedArgs.location);
      const tip = cleanNullable(parsedArgs.tip);

      if (title !== undefined) {
        updates.title = title || event.title;
        changes.push(`Renamed event to "${updates.title}".`);
      }
      if (startTime !== undefined) {
        updates.startTime = startTime;
        changes.push(startTime ? `Set start time to ${startTime}.` : "Cleared the start time.");
      }
      if (endTime !== undefined) {
        updates.endTime = endTime;
        changes.push(endTime ? `Set end time to ${endTime}.` : "Cleared the end time.");
      }
      if (category !== undefined) {
        updates.category = normalizeEventCategory(category || event.category);
        changes.push(`Set category to ${updates.category}.`);
      }
      if (description !== undefined) {
        updates.description = description;
        changes.push(description ? "Updated the event description." : "Cleared the event description.");
      }
      if (location !== undefined) {
        const resolvedCoordinates = await inferEventCoordinates({
          title: title || event.title,
          category: category || event.category,
          location,
          fallbackDayLocation: event.day.location,
          latitude: parsedArgs.latitude,
          longitude: parsedArgs.longitude,
        });
        updates.location = resolvedCoordinates.location;
        updates.lat = resolvedCoordinates.lat;
        updates.lng = resolvedCoordinates.lng;
        changes.push(location ? `Updated event location to ${location}.` : "Cleared the event location.");
      }
      if (tip !== undefined) {
        updates.tip = tip;
        changes.push(tip ? "Updated the event tip." : "Cleared the event tip.");
      }
      if (
        location === undefined &&
        (parsedArgs.latitude !== null || parsedArgs.longitude !== null)
      ) {
        if (parsedArgs.latitude !== null) {
          updates.lat = String(parsedArgs.latitude);
        }
        if (parsedArgs.longitude !== null) {
          updates.lng = String(parsedArgs.longitude);
        }
        changes.push("Updated event coordinates.");
      }
      if (parsedArgs.cost !== null) {
        updates.cost = String(parsedArgs.cost);
        changes.push(`Set event cost to $${parsedArgs.cost.toFixed(2)}.`);
      }
      if (parsedArgs.isBooked !== null) {
        updates.isBooked = parsedArgs.isBooked;
        changes.push(parsedArgs.isBooked ? "Marked the event as booked." : "Marked the event as not booked.");
      }

      const [updated] = await input.db
        .update(events)
        .set(updates)
        .where(eq(events.id, event.id))
        .returning();

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "update_event",
        summary: changes.join(" "),
        details: {
          eventId: event.id,
          previous: snapshotEvent(event),
          updated: snapshotEvent(updated),
        },
      });

      return {
        output: updated,
        summary: changes.join(" ") || "No event changes were needed.",
        cards: changes.length
          ? [buildMutationCard(`Updated event #${event.id}`, changes, event.title)]
          : [],
        undoable: changes.length > 0,
      };
    }

    case "delete_event": {
      const parsedArgs = toolValidators.delete_event.parse(rawArguments);
      const event = await input.db.query.events.findFirst({
        where: eq(events.id, parsedArgs.eventId),
        with: { day: true },
      });
      if (!event || event.day.tripId !== input.activeTrip.id) {
        throw new Error("Event not found on the active trip.");
      }

      await input.db.delete(events).where(eq(events.id, event.id));
      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const summary = `Deleted "${event.title}" from ${event.day.date}.`;
      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "delete_event",
        summary,
        details: {
          eventId: event.id,
          reason: parsedArgs.reason,
          deletedEvent: snapshotEvent(event),
        },
      });

      return {
        output: { success: true, eventId: event.id },
        summary,
        cards: [buildMutationCard("Removed itinerary event", [summary])],
        undoable: true,
      };
    }

    case "create_expense": {
      const parsedArgs = toolValidators.create_expense.parse(rawArguments);
      const purchaseDate = cleanNullable(parsedArgs.purchaseDate) ?? null;
      const existingExpenses = await input.db.query.expenses.findMany({
        where: eq(expenses.tripId, input.activeTrip.id),
      });
      const duplicateExpenseKey = buildExpenseDuplicateKey({
        category: parsedArgs.category,
        description: parsedArgs.description,
        amount: parsedArgs.amount,
        purchaseDate,
      });
      const duplicateExpense = existingExpenses.find(
        (expense) =>
          buildExpenseDuplicateKey({
            category: expense.category,
            description: expense.description,
            amount: expense.amount,
            purchaseDate: expense.purchaseDate,
          }) === duplicateExpenseKey
      );

      if (duplicateExpense) {
        return {
          output: {
            skipped: true,
            reason: "duplicate_expense",
            expenseId: duplicateExpense.id,
          },
          summary: `Skipped duplicate budget item "${parsedArgs.description}".`,
        };
      }

      const [created] = await input.db
        .insert(expenses)
        .values({
          tripId: input.activeTrip.id,
          category: parsedArgs.category,
          description: parsedArgs.description,
          amount: String(parsedArgs.amount),
          isBooked: parsedArgs.isBooked,
          isPaid: parsedArgs.isPaid,
          purchaseDate,
          notes: cleanNullable(parsedArgs.notes) ?? null,
          receiptUrl: cleanNullable(parsedArgs.receiptUrl) ?? null,
        })
        .returning();

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const summary = `Added expense "${parsedArgs.description}" for $${parsedArgs.amount.toFixed(2)}.`;
      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "create_expense",
        summary,
        details: {
          createdExpenseId: created.id,
        },
      });

      return {
        output: created,
        summary,
        cards: [buildMutationCard("Added budget item", [summary])],
        undoable: true,
      };
    }

    case "set_budget_items": {
      const parsedArgs = toolValidators.set_budget_items.parse(rawArguments);
      const existingExpenses = await input.db.query.expenses.findMany({
        where: eq(expenses.tripId, input.activeTrip.id),
      });
      const previousExpenses = parsedArgs.replaceExisting
        ? existingExpenses.map(snapshotExpense)
        : [];

      if (parsedArgs.replaceExisting && existingExpenses.length) {
        await input.db.delete(expenses).where(eq(expenses.tripId, input.activeTrip.id));
      }

      const seenDuplicateKeys = new Set(
        parsedArgs.replaceExisting
          ? []
          : existingExpenses.map((expense) =>
              buildExpenseDuplicateKey({
                category: expense.category,
                description: expense.description,
                amount: expense.amount,
                purchaseDate: expense.purchaseDate,
              })
            )
      );
      const skippedDuplicates: string[] = [];

      const normalizedItems = parsedArgs.items.flatMap((item) => {
        const purchaseDate = cleanNullable(item.purchaseDate) ?? null;
        const duplicateKey = buildExpenseDuplicateKey({
          category: item.category,
          description: item.description,
          amount: item.amount,
          purchaseDate,
        });

        if (seenDuplicateKeys.has(duplicateKey)) {
          skippedDuplicates.push(item.description);
          return [];
        }

        seenDuplicateKeys.add(duplicateKey);
        return [
          {
            tripId: input.activeTrip.id,
            category: item.category,
            description: item.description,
            amount: String(item.amount),
            isBooked: item.isBooked,
            isPaid: item.isPaid,
            purchaseDate,
            notes: cleanNullable(item.notes) ?? null,
            receiptUrl: cleanNullable(item.receiptUrl) ?? null,
          },
        ];
      });

      const inserted = normalizedItems.length
        ? await input.db.insert(expenses).values(normalizedItems).returning()
        : [];

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const previewChanges = inserted
        .slice(0, 8)
        .map(
          (expense) =>
            `${expense.category}: ${expense.description} · $${Number(expense.amount).toFixed(2)}`
        );
      if (inserted.length > 8) {
        previewChanges.push(`Added ${inserted.length - 8} more budget items.`);
      }
      previewChanges.push(
        ...skippedDuplicates
          .slice(0, 4)
          .map((description) => `Skipped duplicate budget item: ${description}`)
      );

      const summary = `Applied ${inserted.length} budget item${inserted.length === 1 ? "" : "s"} to the trip.${skippedDuplicates.length ? ` Skipped ${skippedDuplicates.length} duplicate${skippedDuplicates.length === 1 ? "" : "s"}.` : ""}`;
      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "set_budget_items",
        summary,
        details: {
          replaceExisting: parsedArgs.replaceExisting,
          previousExpenses,
          insertedExpenseIds: inserted.map((expense) => expense.id),
        },
      });

      return {
        output: {
          expenseCount: inserted.length,
          replacedExisting: parsedArgs.replaceExisting,
        },
        summary,
        cards: [buildMutationCard("Applied trip budget", previewChanges)],
        undoable: inserted.length > 0 || previousExpenses.length > 0,
      };
    }

    case "create_packing_item": {
      const parsedArgs = toolValidators.create_packing_item.parse(rawArguments);
      const day =
        parsedArgs.dayDate === null
          ? null
          : await getDayByDate(input.db, input.activeTrip.id, parsedArgs.dayDate);
      const existingPackingItems = await input.db.query.packingItems.findMany({
        where: eq(packingItems.tripId, input.activeTrip.id),
      });
      const duplicatePackingKey = buildPackingDuplicateKey({
        category: parsedArgs.category,
        name: parsedArgs.name,
        daySpecific: day?.id ?? null,
      });
      const duplicatePackingItem = existingPackingItems.find(
        (item) =>
          buildPackingDuplicateKey({
            category: item.category,
            name: item.name,
            daySpecific: item.daySpecific ?? null,
          }) === duplicatePackingKey
      );

      if (duplicatePackingItem) {
        return {
          output: {
            skipped: true,
            reason: "duplicate_packing_item",
            packingItemId: duplicatePackingItem.id,
          },
          summary: `Skipped duplicate packing item "${parsedArgs.name}".`,
        };
      }

      const [created] = await input.db
        .insert(packingItems)
        .values({
          tripId: input.activeTrip.id,
          category: normalizePackingCategory(parsedArgs.category, parsedArgs.name),
          name: parsedArgs.name,
          quantity: Math.max(1, Math.round(parsedArgs.quantity)),
          isPacked: parsedArgs.isPacked,
          isEssential: parsedArgs.isEssential,
          daySpecific: day?.id ?? null,
          notes: cleanNullable(parsedArgs.notes) ?? null,
        })
        .returning();

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const summary = `Added packing item "${parsedArgs.name}"${day ? ` for ${day.date}` : ""}.`;
      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "create_packing_item",
        summary,
        details: {
          createdPackingItemId: created.id,
        },
      });

      return {
        output: created,
        summary,
        cards: [buildMutationCard("Added packing item", [summary])],
        undoable: true,
      };
    }

    case "set_packing_list": {
      const parsedArgs = toolValidators.set_packing_list.parse(rawArguments);
      const existingPackingItems = await input.db.query.packingItems.findMany({
        where: eq(packingItems.tripId, input.activeTrip.id),
      });
      const previousPackingItems = parsedArgs.replaceExisting
        ? existingPackingItems.map(snapshotPackingItem)
        : [];

      if (parsedArgs.replaceExisting && existingPackingItems.length) {
        await input.db.delete(packingItems).where(eq(packingItems.tripId, input.activeTrip.id));
      }

      const seenDuplicateKeys = new Set(
        parsedArgs.replaceExisting
          ? []
          : existingPackingItems.map((item) =>
              buildPackingDuplicateKey({
                category: item.category,
                name: item.name,
                daySpecific: item.daySpecific ?? null,
              })
            )
      );
      const skippedDuplicates: string[] = [];
      const normalizedItems = [];

      for (const item of parsedArgs.items) {
        const day =
          item.dayDate === null
            ? null
            : await getDayByDate(input.db, input.activeTrip.id, item.dayDate);
        const duplicateKey = buildPackingDuplicateKey({
          category: item.category,
          name: item.name,
          daySpecific: day?.id ?? null,
        });

        if (seenDuplicateKeys.has(duplicateKey)) {
          skippedDuplicates.push(item.name);
          continue;
        }

        seenDuplicateKeys.add(duplicateKey);
        normalizedItems.push({
          tripId: input.activeTrip.id,
          category: normalizePackingCategory(item.category, item.name),
          name: item.name,
          quantity: Math.max(1, Math.round(item.quantity)),
          isPacked: item.isPacked,
          isEssential: item.isEssential,
          daySpecific: day?.id ?? null,
          notes: cleanNullable(item.notes) ?? null,
        });
      }

      const inserted = normalizedItems.length
        ? await input.db.insert(packingItems).values(normalizedItems).returning()
        : [];

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const previewChanges = inserted
        .slice(0, 10)
        .map((item) => `${item.name}${item.quantity && item.quantity > 1 ? ` x ${item.quantity}` : ""}`);
      if (inserted.length > 10) {
        previewChanges.push(`Added ${inserted.length - 10} more packing items.`);
      }
      previewChanges.push(
        ...skippedDuplicates
          .slice(0, 4)
          .map((name) => `Skipped duplicate packing item: ${name}`)
      );

      const summary = `Applied ${inserted.length} packing item${inserted.length === 1 ? "" : "s"} to the trip.${skippedDuplicates.length ? ` Skipped ${skippedDuplicates.length} duplicate${skippedDuplicates.length === 1 ? "" : "s"}.` : ""}`;
      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "set_packing_list",
        summary,
        details: {
          replaceExisting: parsedArgs.replaceExisting,
          previousPackingItems,
          insertedPackingItemIds: inserted.map((item) => item.id),
        },
      });

      return {
        output: {
          itemCount: inserted.length,
          replacedExisting: parsedArgs.replaceExisting,
        },
        summary,
        cards: [buildMutationCard("Applied packing list", previewChanges)],
        undoable: inserted.length > 0 || previousPackingItems.length > 0,
      };
    }

    case "create_reminder": {
      const parsedArgs = toolValidators.create_reminder.parse(rawArguments);
      const day =
        parsedArgs.dayDate === null
          ? null
          : await getDayByDate(input.db, input.activeTrip.id, parsedArgs.dayDate);

      const [created] = await input.db
        .insert(reminders)
        .values({
          tripId: input.activeTrip.id,
          title: parsedArgs.title,
          body: cleanNullable(parsedArgs.body) ?? null,
          dueDate: cleanNullable(parsedArgs.dueDate) ?? null,
          priority: parsedArgs.priority,
          isDone: false,
          dayId: day?.id ?? null,
        })
        .returning();

      await touchTrip(input.db, input.activeTrip.id);
      revalidateTripViews();

      const summary = `Added reminder "${parsedArgs.title}"${parsedArgs.dueDate ? ` due ${parsedArgs.dueDate}` : ""}.`;
      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId: input.activeTrip.id,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "create_reminder",
        summary,
        details: {
          createdReminderId: created.id,
        },
      });

      return {
        output: created,
        summary,
        cards: [buildMutationCard("Added reminder", [summary])],
        undoable: true,
      };
    }

    case "update_list_items": {
      const parsedArgs = toolValidators.update_list_items.parse(rawArguments);
      const tripId = input.activeTrip.id;
      const changes: Array<{ kind: string; id: number; action: string; previous: Record<string, unknown> }> = [];
      const lines: string[] = [];

      for (const item of parsedArgs.items) {
        if (item.kind === "packing") {
          const existing = await input.db.query.packingItems.findFirst({
            where: and(eq(packingItems.id, item.id), eq(packingItems.tripId, tripId)),
          });
          if (!existing) continue;
          if (item.action === "delete") {
            await input.db.delete(packingItems).where(eq(packingItems.id, existing.id));
            lines.push(`Removed "${existing.name}" from packing.`);
          } else {
            await input.db
              .update(packingItems)
              .set({
                ...(item.done !== null ? { isPacked: item.done } : {}),
                ...(item.title ? { name: item.title } : {}),
              })
              .where(eq(packingItems.id, existing.id));
            lines.push(`Updated "${item.title ?? existing.name}"${item.done !== null ? (item.done ? " (packed)" : " (unpacked)") : ""}.`);
          }
          changes.push({ kind: "packing", id: existing.id, action: item.action, previous: { ...existing } });
        } else if (item.kind === "todo") {
          const existing = await input.db.query.reminders.findFirst({
            where: and(eq(reminders.id, item.id), eq(reminders.tripId, tripId)),
          });
          if (!existing) continue;
          if (item.action === "delete") {
            await input.db.delete(reminders).where(eq(reminders.id, existing.id));
            lines.push(`Removed to-do "${existing.title}".`);
          } else {
            await input.db
              .update(reminders)
              .set({
                ...(item.done !== null ? { isDone: item.done } : {}),
                ...(item.title ? { title: item.title } : {}),
              })
              .where(eq(reminders.id, existing.id));
            lines.push(`Updated to-do "${item.title ?? existing.title}"${item.done ? " (done)" : ""}.`);
          }
          changes.push({ kind: "todo", id: existing.id, action: item.action, previous: { ...existing } });
        } else {
          const existing = await input.db.query.expenses.findFirst({
            where: and(eq(expenses.id, item.id), eq(expenses.tripId, tripId)),
          });
          if (!existing) continue;
          if (item.action === "delete") {
            await input.db.delete(expenses).where(eq(expenses.id, existing.id));
            lines.push(`Removed expense "${existing.description}".`);
          } else {
            await input.db
              .update(expenses)
              .set({
                ...(item.done !== null ? { isPaid: item.done } : {}),
                ...(item.title ? { description: item.title } : {}),
                ...(item.amount !== null ? { amount: String(item.amount) } : {}),
              })
              .where(eq(expenses.id, existing.id));
            lines.push(`Updated expense "${item.title ?? existing.description}".`);
          }
          changes.push({ kind: "expense", id: existing.id, action: item.action, previous: { ...existing } });
        }
      }

      if (!changes.length) {
        return { output: { updated: 0, error: "No matching items were found on this trip." } };
      }

      await touchTrip(input.db, tripId);
      revalidateTripViews();
      const summary = lines.join(" ");
      await createAiActionLog(input.db, {
        userId: input.appUser.id,
        tripId,
        conversationId: input.conversationId,
        messageId: input.userMessageId,
        actionType: "update_list_items",
        summary,
        details: { changes },
      });

      return {
        output: { updated: changes.length },
        summary,
        cards: [buildMutationCard("Updated lists", lines)],
        undoable: true,
      };
    }

    case "estimate_route": {
      const parsedArgs = toolValidators.estimate_route.parse(rawArguments);
      const result = await estimateRoute(parsedArgs.origin, parsedArgs.destination);
      const summary = `Estimated ${result.durationMinutes} minutes and ${result.distanceKm} km from ${result.origin.label} (${result.origin.timeZone}) to ${result.destination.label} (${result.destination.timeZone}).`;
      return {
        output: result,
        summary,
      };
    }

    default:
      return { output: { error: `Unknown tool ${String(input.toolName)}` } };
  }
}

const WEB_SEARCH_TOOL = { type: "web_search" } as const;

function describeToolProgress(toolName: string, rawArguments: string, tripContext: AiTripContext) {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArguments || "{}") as Record<string, unknown>;
  } catch {}
  const dayLabel = () => {
    const date = typeof args.date === "string" ? args.date : null;
    const dayId = typeof args.dayId === "number" ? args.dayId : null;
    const day = tripContext.days.find((item) => item.date === date || item.id === dayId);
    return day ? `Day ${day.dayNumber}` : "the plan";
  };
  switch (toolName) {
    case "set_trip_structure":
      return "Reshaping the trip";
    case "update_trip_details":
      return "Updating trip details";
    case "update_day_details":
    case "set_day_itinerary":
    case "create_event":
    case "update_event":
    case "delete_event":
      return `Updating ${dayLabel()}`;
    case "create_expense":
    case "set_budget_items":
      return "Updating the budget";
    case "create_packing_item":
    case "set_packing_list":
      return "Updating the packing list";
    case "create_reminder":
      return "Adding a to-do";
    case "update_list_items":
      return "Updating your lists";
    case "estimate_route":
      return "Checking drive times";
    default:
      return "Working";
  }
}

async function callAiModel(input: {
  history: Awaited<ReturnType<typeof listAiMessages>>;
  tripContext: AiTripContext;
  currentMessage: string;
  files?: AiUploadedFile[];
  signal?: AbortSignal;
}) {
  return createOpenAiResponse({
    body: {
      model: AI_MODEL,
      reasoning: { effort: AI_REASONING_EFFORT },
      instructions: buildSystemPrompt({ tripContext: input.tripContext }),
      input: buildUserInputWithGrounding(
        input.history,
        input.tripContext,
        input.currentMessage,
        input.files ?? []
      ),
      tools: [WEB_SEARCH_TOOL, ...toolDefinitions],
    },
    signal: input.signal,
  });
}

function hasWebSearchCall(response: Awaited<ReturnType<typeof createOpenAiResponse>>) {
  return (response.output ?? []).some((item) => item.type === "web_search_call");
}

export async function runAiTurn(input: {
  appUser: AppUser;
  activeTrip: Trip;
  conversationId?: number | null;
  message: string;
  uploadedFiles?: AiUploadedFile[];
  signal?: AbortSignal;
  onProgress?: (label: string) => void;
}) {
  const db = requireDb();
  const progress = (label: string) => {
    try {
      input.onProgress?.(label);
    } catch {}
  };

  let conversation =
    input.conversationId && Number.isFinite(input.conversationId)
      ? await getAiConversation(db, input.appUser.id, input.activeTrip.id, input.conversationId)
      : null;

  if (!conversation) {
    conversation = await createAiConversation(
      db,
      input.appUser.id,
      input.activeTrip.id,
      truncate(input.message.trim() || "New conversation")
    );
  }

  const userMessage = await createAiMessage(db, {
    conversationId: conversation.id,
    role: "user",
    content: input.message.trim(),
    metadata: input.uploadedFiles?.length
      ? {
          attachments: input.uploadedFiles.map((file) => ({
            fileId: file.fileId,
            filename: file.filename,
            mimeType: file.mimeType,
            bytes: file.bytes,
          })),
        }
      : null,
  });

  if (!isOpenAiConfigured()) {
    const assistantMessage = await createAiMessage(db, {
      conversationId: conversation.id,
      role: "assistant",
      content: "Northstar AI isn't configured on this server.",
      followups: [],
    });
    return { conversation, message: assistantMessage };
  }

  assertNotAborted(input.signal);
  let tripContext = await buildAiTripContext(db, input.activeTrip.id, input.appUser.id);
  // History excludes the message we just stored; it is sent separately as the current request.
  const history = (await listAiMessages(db, conversation.id)).filter(
    (message) => message.id !== userMessage.id
  );
  const currentTurnFiles = input.uploadedFiles ?? [];
  const priorFiles = collectConversationFiles(history);
  const seenFileKeys = new Set<string>();
  const availableFiles = [...currentTurnFiles, ...priorFiles].filter((file) => {
    const key = file.fileData ?? file.fileId ?? file.filename;
    if (seenFileKeys.has(key)) return false;
    seenFileKeys.add(key);
    return true;
  });

  progress("Thinking");
  let response = await callAiModel({
    history,
    tripContext,
    currentMessage: input.message,
    files: availableFiles,
    signal: input.signal,
  });

  const cards: AiCard[] = [];
  const toolSummaries: string[] = [];
  const followupsFromTools: string[] = [];
  const usedTools: string[] = [];
  let hasUndoableChanges = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    assertNotAborted(input.signal);
    if (hasWebSearchCall(response)) {
      usedTools.push("web_search");
    }
    const functionCalls = getFunctionCalls(response);
    if (!functionCalls.length) {
      break;
    }

    const outputs = [];

    for (const call of functionCalls) {
      assertNotAborted(input.signal);
      const toolName = call.name as keyof typeof toolValidators;
      if (!(toolName in toolValidators)) {
        outputs.push(buildFunctionCallOutput(call.call_id, { error: `Unknown tool ${call.name}` }));
        continue;
      }

      usedTools.push(toolName);
      progress(describeToolProgress(toolName, call.arguments, tripContext));
      try {
        const result = await executeToolCall({
          db,
          appUser: input.appUser,
          activeTrip: input.activeTrip,
          conversationId: conversation.id,
          userMessageId: userMessage.id,
          tripContext,
          toolName,
          rawArguments: call.arguments,
        });
        outputs.push(buildFunctionCallOutput(call.call_id, result.output));
        if (result.cards?.length) cards.push(...result.cards);
        if (result.summary) toolSummaries.push(result.summary);
        if (result.followups?.length) followupsFromTools.push(...result.followups);
        if (result.undoable) hasUndoableChanges = true;

        if (toolName !== "estimate_route") {
          assertNotAborted(input.signal);
          tripContext = await buildAiTripContext(db, input.activeTrip.id, input.appUser.id);
        }
      } catch (error) {
        outputs.push(
          buildFunctionCallOutput(call.call_id, {
            error: error instanceof Error ? error.message : "Tool execution failed.",
          })
        );
      }
    }

    assertNotAborted(input.signal);
    progress("Thinking");
    response = await createOpenAiResponse({
      body: {
        model: AI_MODEL,
        reasoning: { effort: AI_REASONING_EFFORT },
        previous_response_id: response.id,
        input: outputs,
        tools: [WEB_SEARCH_TOOL, ...toolDefinitions],
      },
      signal: input.signal,
    });
  }

  assertNotAborted(input.signal);
  const sources = getResponseSources(response).slice(0, 6);
  let finalText = getResponseText(response);
  if (!finalText) {
    finalText = toolSummaries.length
      ? `Updated the trip.\n\n${toolSummaries.join("\n")}`
      : "I couldn't finish that. Try rephrasing or breaking it into smaller steps.";
  }

  const followups = Array.from(new Set(followupsFromTools)).slice(0, 3);

  const assistantMessage = await createAiMessage(db, {
    conversationId: conversation.id,
    role: "assistant",
    content: finalText,
    cards,
    followups,
    metadata: {
      sourceUserMessageId: userMessage.id,
      undoable: hasUndoableChanges,
      undoApplied: false,
      usedTools: Array.from(new Set(usedTools)),
      model: AI_MODEL,
      sources,
    },
  });

  return { conversation, message: assistantMessage };
}

export async function undoAiTurnForAssistantMessage(input: {
  appUser: AppUser;
  activeTrip: Trip;
  conversationId: number;
  assistantMessageId: number;
}) {
  const db = requireDb();
  return undoAiAssistantMessage({
    db,
    appUser: input.appUser,
    activeTrip: input.activeTrip,
    conversationId: input.conversationId,
    assistantMessageId: input.assistantMessageId,
  });
}
