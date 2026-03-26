import { z } from "zod";

export const eventSchema = z.object({
  dayId: z.coerce.number().int().positive(),
  title: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  lat: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => (value === "" || value === undefined ? null : value)),
  lng: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => (value === "" || value === undefined ? null : value)),
  tip: z.string().optional().or(z.literal("")),
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
    .transform((value) => (value === "" || value === undefined ? null : Number(value))),
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
    .transform((value) => (value === "" || value === undefined ? null : Number(value))),
});
