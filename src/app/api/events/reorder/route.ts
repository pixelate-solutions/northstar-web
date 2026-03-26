import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { events } from "@/db/schema";
import { reorderSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: "DATABASE_URL is required before events can be reordered." },
      { status: 503 }
    );
  }

  const payload = reorderSchema.parse(await request.json());

  await Promise.all(
    payload.items.map((item) =>
      db
        .update(events)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
        .where(eq(events.id, item.id))
    )
  );

  return NextResponse.json({ success: true });
}
