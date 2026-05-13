import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { days, events, locations, trips } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import {
  addMinutesToTime,
  findRecommendationById,
  getRecommendationsForDay,
  getSuggestedStartTime,
  type PlaceRecommendation,
} from "@/lib/recommendations";

const recommendationRequestSchema = z.object({
  dayId: z.coerce.number().int().positive(),
  recommendationId: z.string().optional(),
  mode: z.enum(["single", "autofill"]).default("single"),
});

function mapsUrl(recommendation: PlaceRecommendation) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${recommendation.lat},${recommendation.lng}`
  )}`;
}

function revalidateRecommendationViews() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/explore");
  revalidatePath("/app/calendar");
  revalidatePath("/app/days");
  revalidatePath("/app/days/[date]", "page");
}

export async function POST(request: Request) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context.error;
  }

  const payload = recommendationRequestSchema.parse(await request.json());
  const day = await context.db.query.days.findFirst({
    where: and(eq(days.id, payload.dayId), eq(days.tripId, context.activeTrip.id)),
    with: {
      events: true,
      locations: true,
    },
  });

  if (!day) {
    return NextResponse.json({ error: "Day not found for this trip." }, { status: 404 });
  }

  const candidates =
    payload.mode === "autofill"
      ? getRecommendationsForDay(day).recommendations
      : payload.recommendationId
      ? [findRecommendationById(payload.recommendationId)].filter(
          (item): item is PlaceRecommendation => Boolean(item)
        )
      : [];

  if (!candidates.length) {
    return NextResponse.json(
      { error: "No recommendations are available for this request." },
      { status: 404 }
    );
  }

  const existingEventTitles = new Set(
    day.events.map((event) => event.title.trim().toLowerCase())
  );
  const existingLocationNames = new Set(
    day.locations.map((location) => location.name.trim().toLowerCase())
  );
  const nextRecommendations = candidates.filter(
    (recommendation) => !existingEventTitles.has(recommendation.title.trim().toLowerCase())
  );

  if (!nextRecommendations.length) {
    return NextResponse.json({
      addedEvents: 0,
      addedLocations: 0,
      message: "Those recommendations are already on this day.",
    });
  }

  const maxSortOrder = Math.max(...day.events.map((event) => event.sortOrder ?? 0), 0);
  let addedLocations = 0;

  await context.db.transaction(async (tx) => {
    await tx.insert(events).values(
      nextRecommendations.map((recommendation, index) => {
        const startTime = getSuggestedStartTime(maxSortOrder + index);
        return {
          dayId: day.id,
          title: recommendation.title,
          startTime,
          endTime: addMinutesToTime(startTime, recommendation.durationMinutes),
          category: recommendation.eventCategory,
          description: recommendation.description,
          location: recommendation.title,
          lat: recommendation.lat,
          lng: recommendation.lng,
          tip: recommendation.tip,
          cost: String(recommendation.cost),
          isBooked: false,
          sortOrder: maxSortOrder + index + 1,
        };
      })
    );

    const locationValues = nextRecommendations
      .filter(
        (recommendation) =>
          !existingLocationNames.has(recommendation.title.trim().toLowerCase())
      )
      .map((recommendation) => ({
        dayId: day.id,
        name: recommendation.title,
        lat: recommendation.lat,
        lng: recommendation.lng,
        type: recommendation.eventCategory,
        description: recommendation.description,
        imageUrl: recommendation.imageUrl,
        tip: recommendation.tip,
        googleMapsUrl: mapsUrl(recommendation),
      }));

    if (locationValues.length) {
      addedLocations = locationValues.length;
      await tx.insert(locations).values(locationValues);
    }

    await tx
      .update(trips)
      .set({ updatedAt: new Date() })
      .where(eq(trips.id, context.activeTrip.id));
  });

  revalidateRecommendationViews();

  return NextResponse.json({
    addedEvents: nextRecommendations.length,
    addedLocations,
  });
}
