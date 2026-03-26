import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { packingItems } from "@/db/schema";
import { packingItemSchema } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before packing items can be updated." },
      { status: 503 }
    );
  }

  const payload = packingItemSchema.partial().parse(await request.json());
  const { id } = await params;
  const [updated] = await db
    .update(packingItems)
    .set(payload)
    .where(eq(packingItems.id, Number(id)))
    .returning();
  revalidatePath("/", "layout");
  revalidatePath("/packing");
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before packing items can be deleted." },
      { status: 503 }
    );
  }

  const { id } = await params;
  await db.delete(packingItems).where(eq(packingItems.id, Number(id)));
  revalidatePath("/", "layout");
  revalidatePath("/packing");
  return NextResponse.json({ success: true });
}
