import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { expenses } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { expenseSchema } from "@/lib/validation";

export async function GET() {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const data = await context.db
    .select()
    .from(expenses)
    .where(eq(expenses.tripId, context.activeTrip.id))
    .orderBy(asc(expenses.category), asc(expenses.description));

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const payload = expenseSchema.parse(await request.json());
  const [created] = await context.db
    .insert(expenses)
    .values({
      ...payload,
      tripId: context.activeTrip.id,
      amount: String(payload.amount),
      purchaseDate: payload.purchaseDate || null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
