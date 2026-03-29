import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { packingItems } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { packingItemSchema } from "@/lib/validation";

type PartialPackingItemPayload = Partial<z.infer<typeof packingItemSchema>>;

function revalidatePacking() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/packing");
}

async function getOwnedPackingItem(itemId: number) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context;
  }

  const item = await context.db.query.packingItems.findFirst({
    where: eq(packingItems.id, itemId),
  });

  if (!item || item.tripId !== context.activeTrip.id) {
    return {
      error: NextResponse.json({ error: "Packing item not found." }, { status: 404 }),
    };
  }

  return {
    ...context,
    item,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getOwnedPackingItem(Number(id));
  if (!("item" in context)) {
    return context.error;
  }

  let payload: PartialPackingItemPayload;
  try {
    payload = packingItemSchema.partial().parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid packing item payload.", details: error.flatten() },
        { status: 400 }
      );
    }

    throw error;
  }

  if (payload.daySpecific !== undefined && payload.daySpecific !== null) {
    const ownedDay = await context.db.query.days.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, payload.daySpecific), eq(table.tripId, context.activeTrip.id)),
    });

    if (!ownedDay) {
      return NextResponse.json({ error: "Target day not found." }, { status: 404 });
    }
  }

  const [updated] = await context.db
    .update(packingItems)
    .set({
      ...(payload.category !== undefined ? { category: payload.category } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
      ...(payload.isPacked !== undefined ? { isPacked: payload.isPacked } : {}),
      ...(payload.isEssential !== undefined ? { isEssential: payload.isEssential } : {}),
      ...(payload.daySpecific !== undefined ? { daySpecific: payload.daySpecific } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes || null } : {}),
    })
    .where(eq(packingItems.id, context.item.id))
    .returning();

  revalidatePacking();
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getOwnedPackingItem(Number(id));
  if (!("item" in context)) {
    return context.error;
  }

  await context.db.delete(packingItems).where(eq(packingItems.id, context.item.id));
  revalidatePacking();
  return NextResponse.json({ success: true });
}
