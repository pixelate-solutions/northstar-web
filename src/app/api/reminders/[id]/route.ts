import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { reminders } from "@/db/schema";
import { reminderSchema } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before reminders can be updated." },
      { status: 503 }
    );
  }

  const payload = reminderSchema.partial().parse(await request.json());
  const { id } = await params;
  const [updated] = await db
    .update(reminders)
    .set({
      ...payload,
      dueDate: payload.dueDate || null,
    })
    .where(eq(reminders.id, Number(id)))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before reminders can be deleted." },
      { status: 503 }
    );
  }

  const { id } = await params;
  await db.delete(reminders).where(eq(reminders.id, Number(id)));
  return NextResponse.json({ success: true });
}
