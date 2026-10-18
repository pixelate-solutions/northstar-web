"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check } from "lucide-react";

import { CategoryPill } from "@/components/trip/category";
import type { EventJson } from "@/lib/client-types";
import { displayClock, money } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

/** Width of the time column (12-hour times need more room). */
export function timeColumnClass(use24Hour: boolean) {
  return use24Hour ? "w-10 sm:w-11" : "w-[62px] sm:w-[68px]";
}

export function StopRow({
  event,
  number,
  selected,
  highlighted,
  draggable,
  onClick,
}: {
  event: EventJson;
  number: number;
  selected: boolean;
  highlighted: boolean;
  draggable: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: event.id, disabled: !draggable });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [{ use24Hour }] = usePrefs();
  const cost = event.cost !== null && Number(event.cost) > 0 ? money(event.cost) : null;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "relative z-10 opacity-80" : ""}>
      <button
        type="button"
        onClick={onClick}
        {...attributes}
        {...listeners}
        className={`group flex h-[52px] w-full items-center gap-3 rounded-[12px] px-3 text-left transition sm:h-[54px] sm:gap-3.5 ${
          highlighted ? "bg-lane-soft" : selected ? "bg-surface" : "hover:bg-surface"
        } ${isDragging ? "bg-white shadow-pop" : ""}`}
      >
        <span
          className={`shrink-0 whitespace-nowrap font-mono text-[12px] sm:text-[13px] ${timeColumnClass(use24Hour)} ${highlighted ? "font-bold text-ink" : "font-medium text-muted"}`}
        >
          {displayClock(event.startTime, use24Hour)}
        </span>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold sm:h-7 sm:w-7 sm:text-[12px] ${
            selected || highlighted ? "bg-lane text-ink" : "bg-ink text-white"
          }`}
        >
          {number}
        </span>
        <span className="min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.01em]">{event.title}</span>
        <CategoryPill category={event.category} className="hidden sm:inline-flex" />
        <span className={`flex w-16 shrink-0 items-center justify-end gap-1 font-mono text-[12px] sm:text-[13px] ${event.isBooked ? "font-semibold text-go" : "font-medium text-ink"}`}>
          {event.isBooked ? <Check size={13} strokeWidth={3} /> : null}
          {cost}
        </span>
      </button>
    </div>
  );
}

export function Leg({ label, drive }: { label: string | null; drive?: boolean }) {
  const [{ use24Hour }] = usePrefs();
  return (
    <div className="flex h-[22px] items-center gap-3 px-3 sm:gap-3.5">
      <span className={`shrink-0 ${timeColumnClass(use24Hour)}`} />
      <span className="flex w-6 shrink-0 justify-center sm:w-7">
        <span className={`h-[22px] ${drive ? "w-[3px] bg-lane" : "w-[2px] bg-line"}`} />
      </span>
      {label ? <span className={`font-mono text-[12px] ${drive ? "font-semibold text-ink" : "font-medium text-muted"}`}>{label}</span> : null}
    </div>
  );
}
