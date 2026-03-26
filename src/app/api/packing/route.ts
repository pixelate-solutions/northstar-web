import { revalidatePath } from "next/cache";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { packingItems } from "@/db/schema";
import { packingItemSchema } from "@/lib/validation";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json([]);

  const data = await db
    .select()
    .from(packingItems)
    .orderBy(asc(packingItems.category), asc(packingItems.name));
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before packing items can be created." },
      { status: 503 }
    );
  }

  const payload = packingItemSchema.parse(await request.json());
  const [created] = await db.insert(packingItems).values(payload).returning();
  revalidatePath("/", "layout");
  revalidatePath("/packing");
  return NextResponse.json(created, { status: 201 });
}
