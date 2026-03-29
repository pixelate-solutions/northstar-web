import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { packingItems } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { packingItemSchema } from "@/lib/validation";

type PackingItemPayload = z.infer<typeof packingItemSchema>;

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
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  let payload: PackingItemPayload;
  try {
    payload = packingItemSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid packing item payload.", details: error.flatten() },
        { status: 400 }
      );
    }

    throw error;
  }

  if (payload.daySpecific !== null) {
    const ownedDay = await context.db.query.days.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, payload.daySpecific), eq(table.tripId, context.activeTrip.id)),
    });

    if (!ownedDay) {
      return NextResponse.json({ error: "Target day not found." }, { status: 404 });
    }
  }

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
