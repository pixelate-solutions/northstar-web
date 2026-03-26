import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { events } from "@/db/schema";
import { eventSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const dayId = Number(new URL(request.url).searchParams.get("dayId"));
  const db = getDb();

  if (!db) return NextResponse.json([]);

  const data = Number.isFinite(dayId) && dayId > 0
    ? await db.select().from(events).where(eq(events.dayId, dayId)).orderBy(asc(events.sortOrder))
    : await db.select().from(events).orderBy(asc(events.dayId), asc(events.sortOrder));

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before events can be created." },
      { status: 503 }
    );
  }

  const payload = eventSchema.parse(await request.json());
  const [created] = await db
    .insert(events)
    .values({
      ...payload,
      cost: payload.cost === null ? null : String(payload.cost),
      lat: payload.lat === null ? null : String(payload.lat),
      lng: payload.lng === null ? null : String(payload.lng),
    })
    .returning();

  revalidatePath("/", "layout");
  revalidatePath("/calendar");
  revalidatePath("/days");
  revalidatePath("/days/[date]", "page");

  return NextResponse.json(created, { status: 201 });
}
