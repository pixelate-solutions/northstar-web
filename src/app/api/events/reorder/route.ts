import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { events } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { reorderSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const payload = reorderSchema.parse(await request.json());
  const existingEvents = await Promise.all(
    payload.items.map((item) =>
      context.db.query.events.findFirst({
        where: eq(events.id, item.id),
        with: { day: true },
      })
    )
  );

  if (
    existingEvents.some(
      (event) => !event || event.day.tripId !== context.activeTrip.id
    )
  ) {
    return NextResponse.json(
      { error: "One or more events do not belong to the active trip." },
      { status: 404 }
    );
  }

  await Promise.all(
    payload.items.map((item) =>
      context.db
        .update(events)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
        .where(eq(events.id, item.id))
    )
  );

  return NextResponse.json({ success: true });
}
