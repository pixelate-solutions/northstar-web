import { z } from "zod";

export const eventSchema = z.object({
  dayId: z.coerce.number().int().positive(),
  title: z.string().min(1),
  startTime: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  endTime: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value ? value : null)),
  category: z.string().min(1).default("other"),
  description: z.union([z.string(), z.null(), z.undefined()]).transform((value) => value || null),
  location: z.union([z.string(), z.null(), z.undefined()]).transform((value) => value || null),
  lat: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => (value === "" || value === undefined ? null : value)),
  lng: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => (value === "" || value === undefined ? null : value)),
  tip: z.union([z.string(), z.null(), z.undefined()]).transform((value) => value || null),
  cost: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => (value === "" || value === undefined ? null : value)),
  isBooked: z.boolean().default(false),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.coerce.number().int().positive(),
      sortOrder: z.coerce.number().int().nonnegative(),
    })
  ),
});

export const packingItemSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  isPacked: z.boolean().default(false),
  isEssential: z.boolean().default(false),
  daySpecific: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) =>
      value === "" || value === undefined || value === null ? null : Number(value)
    ),
  notes: z.string().optional().or(z.literal("")),
});

export const expenseSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  isBooked: z.boolean().default(false),
  isPaid: z.boolean().default(false),
  purchaseDate: z.string().optional().or(z.literal("")),
  receiptUrl: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const reminderSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  isDone: z.boolean().default(false),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  dayId: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) =>
      value === "" || value === undefined || value === null ? null : Number(value)
    ),
});

export const locationSchema = z.object({
  dayId: z.coerce.number().int().positive(),
  name: z.string().min(1),
  lat: z.union([z.string(), z.number()]).transform((value) => String(value)),
  lng: z.union([z.string(), z.number()]).transform((value) => String(value)),
  type: z.string().min(1),
  description: z.string().optional().or(z.literal("")),
  imageUrl: z.string().optional().or(z.literal("")),
  tip: z.string().optional().or(z.literal("")),
  googleMapsUrl: z.string().optional().or(z.literal("")),
});

const nullableText = z.union([z.string(), z.null()]).transform((value) => (value ? value : null));
const nullableNumeric = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (value === "" || value === null ? null : String(value)));

/** Partial event update: only keys present in the body are changed. No defaults. */
export const eventPatchSchema = z
  .object({
    dayId: z.coerce.number().int().positive(),
    title: z.string().min(1),
    startTime: nullableText,
    endTime: nullableText,
    category: z.string().min(1),
    description: nullableText,
    location: nullableText,
    lat: nullableNumeric,
    lng: nullableNumeric,
    tip: nullableText,
    cost: nullableNumeric,
    isBooked: z.boolean(),
    sortOrder: z.coerce.number().int().nonnegative(),
  })
  .partial()
  .strict();

/** Parses a JSON body with a zod schema and returns a 400 response instead of throwing. */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ data: z.output<T> } | { error: Response }> {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: Response.json(
        { error: "Invalid request.", details: result.error.issues },
        { status: 400 }
      ),
    };
  }
  return { data: result.data };
}

const nullableId = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (value === "" || value === null ? null : Number(value)));

/** Partial updates below intentionally have no defaults so untouched fields keep their values. */
export const packingItemPatchSchema = z
  .object({
    category: z.string().min(1),
    name: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    isPacked: z.boolean(),
    isEssential: z.boolean(),
    daySpecific: nullableId,
    notes: nullableText,
  })
  .partial()
  .strict();

export const expensePatchSchema = z
  .object({
    category: z.string().min(1),
    description: z.string().min(1),
    amount: z.coerce.number().nonnegative(),
    isBooked: z.boolean(),
    isPaid: z.boolean(),
    purchaseDate: nullableText,
    receiptUrl: nullableText,
    notes: nullableText,
  })
  .partial()
  .strict();

export const reminderPatchSchema = z
  .object({
    title: z.string().min(1),
    body: nullableText,
    dueDate: nullableText,
    isDone: z.boolean(),
    priority: z.enum(["high", "medium", "low"]),
    dayId: nullableId,
  })
  .partial()
  .strict();
