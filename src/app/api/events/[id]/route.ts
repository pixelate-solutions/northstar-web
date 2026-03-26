import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { events } from "@/db/schema";
import { eventSchema } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before events can be updated." },
      { status: 503 }
    );
  }

  const payload = eventSchema.parse(await request.json());
  const { id } = await params;
  const [updated] = await db
    .update(events)
    .set({
      ...payload,
      cost: payload.cost === null ? null : String(payload.cost),
      lat: payload.lat === null ? null : String(payload.lat),
      lng: payload.lng === null ? null : String(payload.lng),
      updatedAt: new Date(),
    })
    .where(eq(events.id, Number(id)))
    .returning();

  revalidatePath("/", "layout");
  revalidatePath("/calendar");
  revalidatePath("/days");
  revalidatePath("/days/[date]", "page");

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before events can be deleted." },
      { status: 503 }
    );
  }

  const { id } = await params;
  await db.delete(events).where(eq(events.id, Number(id)));
  revalidatePath("/", "layout");
  revalidatePath("/calendar");
  revalidatePath("/days");
  revalidatePath("/days/[date]", "page");
  return NextResponse.json({ success: true });
}
