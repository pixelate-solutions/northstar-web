import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { packingItems } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { packingItemSchema } from "@/lib/validation";

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

  const payload = packingItemSchema.partial().parse(await request.json());
  const [updated] = await context.db
    .update(packingItems)
    .set(payload)
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
