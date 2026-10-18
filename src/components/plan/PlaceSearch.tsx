"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api-client";

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** Debounced place lookups biased toward a point (usually the day's other stops). */
export function usePlaceSearch(query: string, near?: { lat: number; lng: number } | null) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }
    const requestId = ++latest.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (near) {
          params.set("lat", String(near.lat));
          params.set("lng", String(near.lng));
        }
        const data = await api<PlaceResult[]>(`/api/places?${params.toString()}`);
        if (requestId === latest.current) setResults(data);
      } catch {
        if (requestId === latest.current) setResults([]);
      } finally {
        if (requestId === latest.current) setLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return { results, loading };
}

export function PlaceResults({
  results,
  activeIndex,
  onPick,
}: {
  results: PlaceResult[];
  activeIndex: number;
  onPick: (place: PlaceResult) => void;
}) {
  if (!results.length) return null;
  return (
    <div className="absolute left-0 right-0 top-full z-[1100] mt-1.5 overflow-hidden rounded-[14px] bg-white p-1 shadow-pop">
      {results.map((place, index) => (
        <button
          key={place.id}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(place)}
          className={`flex w-full items-start gap-2.5 rounded-[10px] px-3 py-2 text-left transition hover:bg-surface ${
            index === activeIndex ? "bg-surface" : ""
          }`}
        >
          <MapPin size={15} className="mt-[3px] shrink-0 text-muted" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold">{place.name}</span>
            {place.address ? <span className="truncate text-[13px] text-muted">{place.address}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/\b(caf[eé]|coffee|restaurant|diner|grill|bistro|bakery|pizza|taco|bar|brewery|breakfast|lunch|dinner|kitchen|eatery)\b/i, "food"],
  [/\b(trail|hike|trailhead|canyon walk|narrows|summit|peak|loop)\b/i, "hike"],
  [/\b(hotel|inn|lodge|motel|resort|airbnb|cabin|campground|hostel|suites)\b/i, "accommodation"],
  [/\b(airport|flight|terminal)\b/i, "flight"],
  [/\b(point|overlook|viewpoint|vista|museum|monument|park|arch|falls|lake|beach|tower|cathedral|bridge)\b/i, "sightseeing"],
  [/\b(drive|road|highway|scenic byway)\b/i, "drive"],
  [/\b(shop|market|mall|store|outlet)\b/i, "shopping"],
  [/\b(show|concert|theater|theatre|casino|tour|stadium)\b/i, "entertainment"],
];

export function guessCategory(text: string) {
  return CATEGORY_HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? "other";
}
