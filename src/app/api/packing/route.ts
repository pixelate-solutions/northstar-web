import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { packingItems } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { packingItemSchema } from "@/lib/validation";

function revalidatePacking() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/packing");
}

export async function GET() {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const data = await context.db
    .select()
    .from(packingItems)
    .where(eq(packingItems.tripId, context.activeTrip.id))
    .orderBy(asc(packingItems.category), asc(packingItems.name));

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const payload = packingItemSchema.parse(await request.json());
  const [created] = await context.db
    .insert(packingItems)
    .values({
      ...payload,
      tripId: context.activeTrip.id,
    })
    .returning();

  revalidatePacking();
  return NextResponse.json(created, { status: 201 });
}
