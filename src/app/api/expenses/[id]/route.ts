import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { expenses } from "@/db/schema";
import { expenseSchema } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before expenses can be updated." },
      { status: 503 }
    );
  }

  const payload = expenseSchema.partial().parse(await request.json());
  const [updated] = await db
    .update(expenses)
    .set({
      ...payload,
      amount: payload.amount === undefined ? undefined : String(payload.amount),
      purchaseDate: payload.purchaseDate || null,
    })
    .where(eq(expenses.id, Number(params.id)))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before expenses can be deleted." },
      { status: 503 }
    );
  }

  await db.delete(expenses).where(eq(expenses.id, Number(params.id)));
  return NextResponse.json({ success: true });
}
