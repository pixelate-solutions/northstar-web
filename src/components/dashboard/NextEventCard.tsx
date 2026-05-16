"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, Zap } from "lucide-react";

import { EventCategoryBadge } from "@/components/schedule/EventCategoryBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@/db/schema";
import {
  formatDate,
  formatTimeRange,
  getEventDistanceLabel,
  isEventActive,
  minutesUntilEvent,
  pluralize,
  timeToMinutes,
} from "@/lib/utils";

function getFallbackDistanceLabel(startTime: string | null, now: Date): string | null {
  const minutes = minutesUntilEvent(startTime, now);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return `Coming up in ${minutes} ${pluralize(minutes, "min")}`;
}

function EventSummary({
  event,
  selectedDate,
  now,
  tone,
}: {
  event: Event;
  selectedDate: string;
  now: Date;
  tone: "current" | "next";
}) {
  const distanceLabel =
    tone === "next"
      ? getEventDistanceLabel(selectedDate, event.startTime, now) ??
        getFallbackDistanceLabel(event.startTime, now)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.28em] text-primary/80">
          {tone === "current" ? "Current event" : "Next up"}
        </p>
        <EventCategoryBadge category={event.category} />
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-xl font-semibold">{event.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{formatDate(selectedDate)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-secondary/60 p-4 text-sm">
          <div className="flex items-start gap-2 text-muted-foreground">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{formatTimeRange(event.startTime, event.endTime)}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-4 text-sm">
          <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{event.location || "Location TBD"}</span>
          </div>
        </div>
      </div>

      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
          tone === "current"
            ? "border border-red-500/25 bg-red-500/10 text-red-700"
            : "border border-primary/25 bg-primary/10 text-primary"
        }`}
      >
        <Zap className="size-4 shrink-0" />
        {tone === "current" ? "Happening now" : distanceLabel ?? "Coming up"}
      </div>
    </div>
  );
}

export function NextEventCard({
  events,
  selectedDate,
}: {
  events: Event[];
  selectedDate: string;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const { current, next } = useMemo(() => {
    const scheduledEvents = events
      .filter((event) => Boolean(event.startTime))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const active = scheduledEvents.find((event) =>
      isEventActive(event.startTime, event.endTime, now)
    );
    const upcoming = scheduledEvents.find(
      (event) => minutesUntilEvent(event.startTime, now) > 0
    );
    return { current: active ?? null, next: upcoming ?? null };
  }, [events, now]);
  const hasEventsToShow = Boolean(current || next);
  const title =
    current && next ? "Current & next up" : current ? "Happening now" : "Next up";

  return (
    <Card className="min-w-0 rounded-[2rem] border border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasEventsToShow ? (
          <>
            {current ? (
              <EventSummary
                event={current}
                selectedDate={selectedDate}
                now={now}
                tone="current"
              />
            ) : null}
            {current && next ? <div className="border-t border-border/60" /> : null}
            {next ? (
              <EventSummary
                event={next}
                selectedDate={selectedDate}
                now={now}
                tone="next"
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {events.length > 0
              ? "No more events are scheduled for the rest of this day."
              : "No events have been scheduled for this day yet."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
