import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { reminders } from "@/db/schema";
import { reminderSchema } from "@/lib/validation";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json([]);

  const data = await db.select().from(reminders).orderBy(asc(reminders.dueDate));
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before reminders can be created." },
      { status: 503 }
    );
  }

  const payload = reminderSchema.parse(await request.json());
  const [created] = await db
    .insert(reminders)
    .values({
      ...payload,
      dueDate: payload.dueDate || null,
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
