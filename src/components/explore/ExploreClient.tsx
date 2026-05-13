"use client";

import { useMemo, useState, startTransition } from "react";
import {
  BedDouble,
  Camera,
  Check,
  Loader2,
  MapPin,
  Mountain,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TripMap } from "@/components/map/TripMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TravelImage } from "@/components/ui/travel-image";
import type { DaySummary } from "@/lib/types";
import {
  EXPLORE_CATEGORIES,
  type PlaceRecommendation,
  type RecommendationCategory,
  type RecommendationCollection,
} from "@/lib/recommendations";
import { cn, formatCurrency, formatDateShort } from "@/lib/utils";

interface ExploreClientProps {
  collections: RecommendationCollection[];
  days: DaySummary[];
  canEdit: boolean;
}

const categoryIcons = {
  MapPin,
  UtensilsCrossed,
  Mountain,
  Camera,
  ShoppingBag,
  BedDouble,
};

export function ExploreClient({ collections, days, canEdit }: ExploreClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecommendationCategory | "all">("all");
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id ?? null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());

  const recommendations = useMemo(
    () => collections.flatMap((collection) => collection.recommendations),
    [collections]
  );
  const activeCollection = collections[0];
  const filteredRecommendations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recommendations.filter((recommendation) => {
      const categoryMatch = category === "all" || recommendation.category === category;
      const queryMatch =
        !needle ||
        `${recommendation.title} ${recommendation.description} ${recommendation.destination}`
          .toLowerCase()
          .includes(needle);
      return categoryMatch && queryMatch;
    });
  }, [category, query, recommendations]);

  async function addRecommendation(recommendation: PlaceRecommendation) {
    if (!selectedDayId) {
      toast.error("Choose a day first.");
      return;
    }

    setPendingKey(recommendation.id);
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayId: selectedDayId,
        recommendationId: recommendation.id,
        mode: "single",
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { addedEvents?: number; message?: string; error?: string }
      | null;
    setPendingKey(null);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to add that recommendation.");
      return;
    }

    setAddedIds((current) => new Set(current).add(recommendation.id));
    toast.success(body?.message ?? `Added ${recommendation.title}.`);
    startTransition(() => router.refresh());
  }

  async function autofillSelectedDay() {
    if (!selectedDayId) {
      toast.error("Choose a day first.");
      return;
    }

    setPendingKey("autofill");
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayId: selectedDayId,
        mode: "autofill",
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { addedEvents?: number; message?: string; error?: string }
      | null;
    setPendingKey(null);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to auto-fill this day.");
      return;
    }

    toast.success(
      body?.message ?? `Auto-filled ${body?.addedEvents ?? 0} recommendation(s).`
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(26rem,0.95fr)]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-[2rem] border border-white/45 bg-white/62 p-5 shadow-[0_22px_54px_rgba(18,43,74,0.09)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <Badge className="w-fit border-primary/20 bg-primary/10 text-primary">
                Explore
              </Badge>
              <div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                  {activeCollection?.destination ?? "Explore"}
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                  {activeCollection?.summary ??
                    "Browse recommended stops, add them to a day, and keep the map in sync."}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-72">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search recommendations"
                  className="h-11 w-full rounded-full border border-white/55 bg-white/78 pl-10 pr-4 text-sm outline-none shadow-[0_10px_24px_rgba(120,126,182,0.08)] transition placeholder:text-muted-foreground focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <Button
                type="button"
                onClick={() => void autofillSelectedDay()}
                disabled={!canEdit || !selectedDayId || pendingKey === "autofill"}
                className="w-full"
              >
                {pendingKey === "autofill" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Auto-fill day
              </Button>
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                category === "all"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-white/55 bg-white/62 text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="size-4" />
              All
            </button>
            {EXPLORE_CATEGORIES.map((item) => {
              const Icon = categoryIcons[item.icon as keyof typeof categoryIcons] ?? MapPin;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                    category === item.id
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-white/55 bg-white/62 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/45 bg-white/58 p-4 shadow-[0_18px_42px_rgba(18,43,74,0.08)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
                Add To Itinerary
              </p>
              <h2 className="mt-1 text-xl font-semibold">Choose a target day</h2>
            </div>
            <Link href="/app/calendar">
              <Button variant="outline" className="w-full sm:w-auto">
                Open Trip Map
              </Button>
            </Link>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {days.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => setSelectedDayId(day.id)}
                className={cn(
                  "min-w-[9.5rem] rounded-[1.25rem] border p-3 text-left transition",
                  selectedDayId === day.id
                    ? "border-primary/35 bg-primary/10 text-foreground"
                    : "border-white/55 bg-white/64 text-muted-foreground hover:text-foreground"
                )}
              >
                <p className="text-sm font-semibold">Day {day.dayNumber}</p>
                <p className="mt-1 text-xs">{formatDateShort(day.date)}</p>
                <p className="mt-1 truncate text-xs">{day.location || day.title}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
                Recommended Places
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                {filteredRecommendations.length} place
                {filteredRecommendations.length === 1 ? "" : "s"} to consider
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredRecommendations.map((recommendation) => {
              const isPending = pendingKey === recommendation.id;
              const isAdded = addedIds.has(recommendation.id);
              return (
                <article
                  key={recommendation.id}
                  className="min-w-0 overflow-hidden rounded-[1.5rem] border border-border/70 bg-white shadow-[0_18px_42px_rgba(18,43,74,0.08)]"
                >
                  <div className="relative h-44 overflow-hidden">
                    <TravelImage
                      src={recommendation.imageUrl}
                      alt={recommendation.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/62 to-transparent p-4 text-white">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-85">
                        {recommendation.destination}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold">
                        {recommendation.title}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-secondary text-foreground">
                        {recommendation.category}
                      </Badge>
                      <Badge className="bg-secondary text-foreground">
                        {formatCurrency(recommendation.cost)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {recommendation.sourceLabel}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {recommendation.description}
                    </p>
                    <p className="rounded-2xl bg-secondary/55 px-3 py-2 text-sm text-foreground">
                      {recommendation.tip}
                    </p>
                    <Button
                      type="button"
                      variant={isAdded ? "secondary" : "default"}
                      className="w-full"
                      disabled={!canEdit || !selectedDayId || isPending}
                      onClick={() => void addRecommendation(recommendation)}
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : isAdded ? (
                        <Check className="size-4" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      {isAdded ? "Added" : "Add to day"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <TripMap days={days} />
      </aside>
    </div>
  );
}
