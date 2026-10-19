"use client";

import { ArrowRightLeft, Check, CircleDashed, Clock, MapPin, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Popover, useConfirm } from "@/components/ns/overlay";
import { PlaceResults, usePlaceSearch, type PlaceResult } from "@/components/plan/PlaceSearch";
import { CATEGORY_OPTIONS, categoryMeta } from "@/components/trip/category";
import { timeColumnClass } from "@/components/plan/StopRow";
import { useTrip, type EventInput } from "@/components/trip/TripProvider";
import type { EventJson } from "@/lib/client-types";
import { clock, displayClock, parseClock, shortDate } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const chip = "flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] bg-surface px-3 text-[14px] font-semibold";

/** One notes field: older stops may also carry text in `description`. */
function mergedNotes(event: EventJson) {
  const parts: string[] = [];
  for (const text of [event.tip, event.description]) {
    const value = text?.trim();
    if (value && !parts.includes(value)) parts.push(value);
  }
  return parts.join("\n\n");
}

export function StopEditor({
  event,
  number,
  near,
  onClose,
}: {
  event: EventJson;
  number: number;
  near: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const { updateEvent, deleteEvent, bundle, canEdit } = useTrip();
  const confirm = useConfirm();
  const [{ use24Hour }] = usePrefs();
  const [title, setTitle] = useState(event.title);
  const [start, setStart] = useState(displayClock(event.startTime, use24Hour));
  const [end, setEnd] = useState(displayClock(event.endTime, use24Hour));
  const [cost, setCost] = useState(event.cost !== null && Number(event.cost) ? String(Number(event.cost)) : "");
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(() => mergedNotes(event));
  const [locationFocused, setLocationFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);


  const locationQuery = locationFocused && location !== (event.location ?? "") ? location : "";
  const { results } = usePlaceSearch(locationQuery, near);
  const meta = categoryMeta(event.category);
  const CategoryIcon = meta.icon;
  const otherDays = useMemo(() => bundle.days.filter((day) => day.id !== event.dayId), [bundle.days, event.dayId]);

  function save(patch: EventInput) {
    if (!canEdit) return;
    void updateEvent(event.id, patch);
  }

  function commitTimes() {
    const nextStart = start ? parseClock(start) : null;
    const nextEnd = end ? parseClock(end) : null;
    if (start && !nextStart) setStart(displayClock(event.startTime, use24Hour));
    if (end && !nextEnd) setEnd(displayClock(event.endTime, use24Hour));
    const patch: EventInput = {};
    if ((nextStart ?? null) !== (event.startTime ? clock(event.startTime) : null)) patch.startTime = nextStart;
    if ((nextEnd ?? null) !== (event.endTime ? clock(event.endTime) : null)) patch.endTime = nextEnd;
    if (nextStart) setStart(displayClock(nextStart, use24Hour));
    if (nextEnd) setEnd(displayClock(nextEnd, use24Hour));
    if (Object.keys(patch).length) save(patch);
  }

  function pickPlace(place: PlaceResult) {
    const address = place.address ? `${place.name}, ${place.address}` : place.name;
    setLocation(address);
    setLocationFocused(false);
    save({ location: address, lat: String(place.lat), lng: String(place.lng) });
  }

  const readOnly = !canEdit;

  return (
    <div className="my-1 flex flex-col gap-3.5 rounded-[16px] border-[1.5px] border-ink bg-white py-3.5 pl-3 pr-4 shadow-[0_8px_24px_rgba(17,17,16,0.08)]">
      <div className="flex items-center gap-3 sm:gap-3.5">
        <span className={`shrink-0 ${timeColumnClass(use24Hour)}`} />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lane font-mono text-[12px] font-semibold">{number}</span>
        <input
          ref={titleRef}
          value={title}
          readOnly={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.trim();
            if (!next) setTitle(event.title);
            else if (next !== event.title) save({ title: next });
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="min-w-0 flex-1 bg-transparent text-[18px] font-bold tracking-[-0.015em]"
          aria-label="Stop name"
        />
        <button type="button" onClick={onClose} className="rounded-full bg-lane px-3.5 py-[7px] text-[14px] font-bold">
          Done
        </button>
      </div>

      <div className={`flex flex-col gap-2.5 ${use24Hour ? "sm:pl-[100px]" : "sm:pl-[124px]"}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className={chip}>
            <Clock size={14} strokeWidth={2.2} />
            <input
              value={start}
              readOnly={readOnly}
              onChange={(e) => setStart(e.target.value)}
              onBlur={commitTimes}
              placeholder="Time"
              className={`${use24Hour ? "w-[46px]" : "w-[66px]"} bg-transparent font-mono text-[13px] font-medium placeholder:font-sans placeholder:text-faint`}
              aria-label="Start time"
            />
            <span className="text-faint">–</span>
            <input
              value={end}
              readOnly={readOnly}
              onChange={(e) => setEnd(e.target.value)}
              onBlur={commitTimes}
              placeholder="End"
              className={`${use24Hour ? "w-[42px]" : "w-[66px]"} bg-transparent font-mono text-[13px] font-medium placeholder:font-sans placeholder:text-faint`}
              aria-label="End time"
            />
          </label>

          <div className="relative">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setCategoryOpen((v) => !v)}
              className={chip}
              style={{ color: meta.color, background: `${meta.color}1F` }}
            >
              <CategoryIcon size={14} strokeWidth={2.2} />
              {meta.label}
            </button>
            <Popover open={categoryOpen} onClose={() => setCategoryOpen(false)} className="left-0 top-11 grid w-[220px] grid-cols-2 gap-0.5">
              {CATEGORY_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setCategoryOpen(false);
                      save({ category: option.value });
                    }}
                    className={`flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[14px] font-semibold hover:bg-surface ${option.value === event.category ? "bg-surface" : ""}`}
                  >
                    <Icon size={14} style={{ color: option.color }} /> {option.label}
                  </button>
                );
              })}
            </Popover>
          </div>

          <label className={chip}>
            <span className="font-mono text-[13px] text-muted">$</span>
            <input
              value={cost}
              readOnly={readOnly}
              inputMode="decimal"
              onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))}
              onBlur={() => {
                const next = cost ? String(Number(cost)) : null;
                const current = event.cost !== null && Number(event.cost) ? String(Number(event.cost)) : null;
                if (next !== current) save({ cost: next });
              }}
              placeholder="Cost"
              className="w-[52px] bg-transparent font-mono text-[13px] font-medium placeholder:font-sans placeholder:text-faint"
              aria-label="Cost"
            />
          </label>

          <button
            type="button"
            disabled={readOnly}
            onClick={() => save({ isBooked: !event.isBooked })}
            className={`${chip} ${event.isBooked ? "bg-go text-white" : "border-[1.5px] border-ink bg-white hover:bg-surface"}`}
            aria-pressed={Boolean(event.isBooked)}
          >
            {event.isBooked ? <Check size={14} strokeWidth={2.6} /> : <CircleDashed size={14} strokeWidth={2.2} />}
            {event.isBooked ? "Booked" : "Mark booked"}
          </button>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 rounded-[8px] bg-surface px-3 py-2.5">
            <MapPin size={15} strokeWidth={2.2} className={event.lat ? "text-ink" : "text-faint"} />
            <input
              value={location}
              readOnly={readOnly}
              onChange={(e) => {
                setLocation(e.target.value);
                setActiveIndex(0);
              }}
              onFocus={() => setLocationFocused(true)}
              onBlur={() => {
                setLocationFocused(false);
                if (location.trim() !== (event.location ?? "")) save({ location: location.trim() || null, lat: null, lng: null });
              }}
              onKeyDown={(e) => {
                if (!results.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  pickPlace(results[activeIndex]);
                }
              }}
              placeholder="Address"
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium placeholder:text-faint"
              aria-label="Address"
            />
          </div>
          {locationFocused ? <PlaceResults results={results} activeIndex={activeIndex} onPick={pickPlace} /> : null}
        </div>

        <textarea
          value={notes}
          readOnly={readOnly}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            const value = notes.trim() || null;
            if (value !== (event.tip ?? null) || event.description) save({ tip: value, description: null });
          }}
          placeholder="Notes"
          rows={Math.min(10, Math.max(3, notes.split("\n").length + Math.floor(notes.length / 70)))}
          className="w-full resize-none rounded-[8px] bg-surface px-3 py-2.5 text-[14px] font-medium leading-5 placeholder:text-faint"
          aria-label="Notes"
        />

        {canEdit ? (
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={async () => {
                if (!(await confirm(`Delete ${event.title}?`))) return;
                onClose();
                void deleteEvent(event.id);
              }}
              className="flex items-center gap-1.5 text-[14px] font-semibold text-stop"
            >
              <Trash2 size={14} /> Delete
            </button>
            <div className="relative">
              <button type="button" onClick={() => setMoveOpen((v) => !v)} className="flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-ink">
                <ArrowRightLeft size={14} /> Move to another day
              </button>
              <Popover open={moveOpen} onClose={() => setMoveOpen(false)} className="bottom-8 right-0 max-h-[300px] w-[240px] overflow-y-auto">
                {otherDays.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => {
                      setMoveOpen(false);
                      onClose();
                      void updateEvent(event.id, { dayId: day.id });
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[14px] font-semibold hover:bg-surface"
                  >
                    <span className="w-5 font-mono text-[12px] text-muted">{day.dayNumber}</span>
                    <span className="flex-1 truncate">{day.title || `Day ${day.dayNumber}`}</span>
                    <span className="font-mono text-[11px] text-muted">{shortDate(day.date)}</span>
                  </button>
                ))}
              </Popover>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
