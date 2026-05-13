import Link from "next/link";
import { ArrowRight, Compass, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TravelImage } from "@/components/ui/travel-image";
import type { DaySummary } from "@/lib/types";
import { getAllRecommendationsForTrip } from "@/lib/recommendations";

export function ExplorePreview({ days }: { days: DaySummary[] }) {
  const recommendations = getAllRecommendationsForTrip(days).slice(0, 4);

  if (!recommendations.length) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-white/45 bg-white/58 p-5 shadow-[0_18px_42px_rgba(18,43,74,0.08)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
            Explore
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Recommended for this trip</h2>
        </div>
        <Link href="/app/explore">
          <Button className="w-full sm:w-auto">
            <Search className="size-4" />
            Browse all
          </Button>
        </Link>
      </div>

      <div className="mt-5 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {recommendations.map((recommendation) => (
          <Link
            key={recommendation.id}
            href="/app/explore"
            className="group min-w-[16rem] overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_32px_rgba(18,43,74,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(18,43,74,0.10)]"
          >
            <div className="h-32 overflow-hidden">
              <TravelImage
                src={recommendation.imageUrl}
                alt={recommendation.title}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
                <Compass className="size-3.5" />
                {recommendation.destination}
              </div>
              <h3 className="line-clamp-2 text-lg font-semibold">
                {recommendation.title}
              </h3>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                {recommendation.description}
              </p>
              <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                Add to itinerary
                <ArrowRight className="size-4" />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
