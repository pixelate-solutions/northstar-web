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

/** "HH:MM" for right now; new stops default to the current time until it's changed. */
function nowClock() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function AddStop({ dayId, near, onAdded }: { dayId: number; near: { lat: number; lng: number } | null; onAdded?: (eventId: number) => void }) {
  const { addEvent } = useTrip();
  const [{ use24Hour }] = usePrefs();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [time, setTime] = useState(nowClock);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [locationFocused, setLocationFocused] = useState(false);
  const { results } = usePlaceSearch(editing && locationFocused && !place ? locationQuery : "", near);

  function reset() {
    setName("");
    setLocationQuery("");
    setPlace(null);
    setTime(nowClock());
    setActiveIndex(-1);
    setEditing(false);
  }

  function pick(result: PlaceResult) {
    setPlace(result);
    setLocationQuery(result.address ? `${result.name}, ${result.address}` : result.name);
    if (!name.trim()) setName(result.name);
    setActiveIndex(-1);
  }

  async function create() {
    // "7:30p Dinner" in the name still sets the time.
    const { time: typedTime, rest } = splitLeadingTime(name);
    const title = (rest.trim() || place?.name || "").slice(0, 200);
    if (!title) return;
    const location = place ? (place.address ? `${place.name}, ${place.address}` : place.name) : locationQuery.trim() || null;
    reset();
    const created = await addEvent(dayId, {
      title,
      startTime: typedTime ?? (time || nowClock()),
      category: guessCategory(`${title} ${place?.address ?? ""}`),
      location,
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

  const field = "h-11 w-full rounded-[10px] bg-white px-3 text-[15px] font-medium placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-ink";

  return (
    <form
      className="relative mt-1.5 flex flex-col gap-2 rounded-[14px] bg-surface p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") reset();
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className={field}
        aria-label="New stop"
      />
      <div className="relative">
        <input
          value={locationQuery}
          onChange={(e) => {
            setLocationQuery(e.target.value);
            setPlace(null);
            setActiveIndex(-1);
          }}
          onFocus={() => setLocationFocused(true)}
          onBlur={() => window.setTimeout(() => setLocationFocused(false), 150)}
          onKeyDown={(e) => {
            if (!results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              pick(results[activeIndex]);
            }
          }}
          placeholder="Location"
          className={field}
          aria-label="New stop location"
        />
        {locationFocused && !place ? <PlaceResults results={results} activeIndex={activeIndex} onPick={pick} /> : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={`${field} w-auto font-mono`}
          aria-label="New stop time"
        />
        <span className="flex-1" />
        <button type="button" onClick={reset} className="h-10 rounded-full px-4 text-[14px] font-semibold text-muted hover:text-ink">
          Cancel
        </button>
        <button type="submit" disabled={!name.trim() && !place} className="h-10 rounded-full bg-ink px-5 text-[14px] font-bold text-white disabled:opacity-40">
          Add
        </button>
      </div>
    </form>
  );
}
