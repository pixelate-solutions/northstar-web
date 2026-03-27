"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

interface MobileDayNavigatorDay {
  id: number;
  date: string;
  title: string;
  dayNumber: number;
}

export function MobileDayNavigator({
  days,
  selectedIndex,
  onSelectIndex,
  allowWholeTrip = false,
  className,
}: {
  days: MobileDayNavigatorDay[];
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  allowWholeTrip?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const selectedDay = selectedIndex === null ? null : days[selectedIndex] ?? null;
  const disablePrevious = selectedIndex === null || (!allowWholeTrip && selectedIndex <= 0);
  const disableNext =
    days.length === 0 ||
    (selectedIndex !== null && selectedIndex >= days.length - 1);

  function goPrevious() {
    if (selectedIndex === null) {
      return;
    }

    if (selectedIndex <= 0) {
      if (allowWholeTrip) {
        onSelectIndex(null);
      }
      return;
    }

    onSelectIndex(selectedIndex - 1);
  }

  function goNext() {
    if (!days.length) {
      return;
    }

    if (selectedIndex === null) {
      onSelectIndex(0);
      return;
    }

    if (selectedIndex >= days.length - 1) {
      return;
    }

    onSelectIndex(selectedIndex + 1);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[1.35rem] border border-white/45 bg-white/72 px-3 py-2 shadow-[0_18px_42px_rgba(191,102,62,0.08)] backdrop-blur-xl",
        className
      )}
    >
      <button
        type="button"
        onClick={goPrevious}
        disabled={disablePrevious}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/92 text-foreground shadow-[0_10px_24px_rgba(28,31,46,0.08)] transition disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" />
      </button>

      <button
        type="button"
        onClick={() => {
          if (!selectedDay) {
            return;
          }

          router.push(`/app/days/${selectedDay.date}`);
        }}
        className="min-w-0 flex-1 rounded-[1.1rem] border border-white/55 bg-white/88 px-4 py-2 text-center transition hover:bg-white disabled:pointer-events-none"
        disabled={!selectedDay}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-primary/75">
          {selectedDay ? "Current Day" : "Whole Trip"}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">
          {selectedDay
            ? `Day ${selectedDay.dayNumber} · ${selectedDay.title}`
            : "All Days"}
        </p>
      </button>

      <button
        type="button"
        onClick={goNext}
        disabled={disableNext}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/92 text-foreground shadow-[0_10px_24px_rgba(28,31,46,0.08)] transition disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next day"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
