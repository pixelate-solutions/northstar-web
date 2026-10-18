"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { guessCategory, PlaceResults, usePlaceSearch, type PlaceResult } from "@/components/plan/PlaceSearch";
import { timeColumnClass } from "@/components/plan/StopRow";
import { useTrip } from "@/components/trip/TripProvider";
import { parseClock } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

/** Splits "7:30p Dinner at X" into a time and the rest. */
function splitLeadingTime(text: string) {
  const match = text.match(/^\s*(\d{1,2}(?::?\d{2})?\s*(?:a|am|p|pm)?)\s+(.+)$/i);
  if (match) {
    const time = parseClock(match[1]);
    if (time) return { time, rest: match[2] };
  }
  return { time: null, rest: text };
}

export function AddStop({ dayId, near, onAdded }: { dayId: number; near: { lat: number; lng: number } | null; onAdded?: (eventId: number) => void }) {
  const { addEvent } = useTrip();
  const [{ use24Hour }] = usePrefs();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const { time, rest } = splitLeadingTime(text);
  const { results } = usePlaceSearch(editing ? rest : "", near);

  async function create(place?: PlaceResult) {
    const title = place?.name ?? rest.trim();
    if (!title) return;
    setText("");
    const created = await addEvent(dayId, {
      title,
      startTime: time,
      category: guessCategory(`${title} ${place?.address ?? ""}`),
      location: place ? (place.address ? `${place.name}, ${place.address}` : place.name) : null,
      lat: place ? String(place.lat) : null,
      lng: place ? String(place.lng) : null,
    });
    if (created && onAdded) onAdded(created.id);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1.5 flex h-[54px] w-full items-center gap-3 rounded-[12px] px-3 text-left transition hover:bg-surface sm:gap-3.5"
      >
        <span className={`shrink-0 ${timeColumnClass(use24Hour)}`} />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#B9B9B4]">
          <Plus size={14} strokeWidth={2.4} />
        </span>
        <span className="text-[16px] font-medium text-muted">Add a stop</span>
      </button>
    );
  }

  return (
    <div className="relative mt-1.5">
      <div className="flex h-[54px] items-center gap-3 rounded-[12px] bg-surface px-3 sm:gap-3.5">
        <span className="w-10 shrink-0 font-mono text-[12px] font-medium text-muted sm:w-11 sm:text-[13px]">{time ?? ""}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#B9B9B4]">
          <Plus size={14} strokeWidth={2.4} />
        </span>
        <input
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActiveIndex(-1);
          }}
          onBlur={() => window.setTimeout(() => !text.trim() && setEditing(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setText("");
              setEditing(false);
            } else if (e.key === "ArrowDown" && results.length) {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp" && results.length) {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              void create(activeIndex >= 0 ? results[activeIndex] : undefined);
            }
          }}
          placeholder="Search a place or type a stop"
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium placeholder:text-faint"
          aria-label="New stop"
        />
      </div>
      <PlaceResults results={results} activeIndex={activeIndex} onPick={(place) => void create(place)} />
    </div>
  );
}
