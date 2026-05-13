"use client";

import { startTransition, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TravelImage } from "@/components/ui/travel-image";
import type { PlaceRecommendation } from "@/lib/recommendations";

export function DayRecommendationsStrip({
  dayId,
  recommendations,
  canEdit,
}: {
  dayId: number;
  recommendations: PlaceRecommendation[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());

  async function addRecommendation(recommendation: PlaceRecommendation) {
    setPendingId(recommendation.id);
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayId,
        recommendationId: recommendation.id,
        mode: "single",
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    setPendingId(null);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to add that recommendation.");
      return;
    }

    setAddedIds((current) => new Set(current).add(recommendation.id));
    toast.success(body?.message ?? `Added ${recommendation.title}.`);
    startTransition(() => router.refresh());
  }

  if (!recommendations.length) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-white/45 bg-white/58 p-5 shadow-[0_18px_42px_rgba(18,43,74,0.08)] backdrop-blur-xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
            Recommended places
          </p>
          <h2 className="mt-1 text-xl font-semibold">Quick add to this day</h2>
        </div>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {recommendations.map((recommendation) => {
          const isPending = pendingId === recommendation.id;
          const isAdded = addedIds.has(recommendation.id);
          return (
            <article
              key={recommendation.id}
              className="min-w-[18rem] overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_32px_rgba(18,43,74,0.07)]"
            >
              <div className="h-28 overflow-hidden">
                <TravelImage
                  src={recommendation.imageUrl}
                  alt={recommendation.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="line-clamp-1 font-semibold">{recommendation.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {recommendation.description}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isAdded ? "secondary" : "outline"}
                  className="w-full"
                  disabled={!canEdit || isPending}
                  onClick={() => void addRecommendation(recommendation)}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isAdded ? (
                    <Check className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {isAdded ? "Added" : "Add stop"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
