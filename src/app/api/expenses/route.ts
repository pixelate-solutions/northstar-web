import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { expenses } from "@/db/schema";
import { expenseSchema } from "@/lib/validation";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json([]);

  const data = await db
    .select()
    .from(expenses)
    .orderBy(asc(expenses.category), asc(expenses.description));
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before expenses can be created." },
      { status: 503 }
    );
  }

  const payload = expenseSchema.parse(await request.json());
  const [created] = await db
    .insert(expenses)
    .values({
      ...payload,
      amount: String(payload.amount),
      purchaseDate: payload.purchaseDate || null,
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
