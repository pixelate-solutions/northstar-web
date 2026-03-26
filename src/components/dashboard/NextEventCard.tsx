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
  timeToMinutes,
} from "@/lib/utils";

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
    const sorted = [...events].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );
    const active = sorted.find((event) => isEventActive(event.startTime, event.endTime, now));
    const upcoming = sorted.find((event) => minutesUntilEvent(event.startTime, now) > 0);
    return { current: active ?? null, next: active ? null : upcoming ?? null };
  }, [events, now]);

  const cardEvent = current ?? next;

  return (
    <Card className="rounded-[2rem] border border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="text-lg">
          {current ? "Happening now" : "Next up"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cardEvent ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{cardEvent.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(selectedDate)}
                </p>
              </div>
              <EventCategoryBadge category={cardEvent.category} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-secondary/60 p-4 text-sm">
                <p className="inline-flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="size-4 text-primary" />
                  {formatTimeRange(cardEvent.startTime, cardEvent.endTime)}
                </p>
              </div>
              <div className="rounded-2xl bg-secondary/60 p-4 text-sm">
                <p className="inline-flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 text-primary" />
                  {cardEvent.location || "Location TBD"}
                </p>
              </div>
            </div>
            {current ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-sm text-red-700">
                <Zap className="size-4" />
                Happening now
              </div>
            ) : next ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm text-primary">
                <Zap className="size-4" />
                {getEventDistanceLabel(selectedDate, next.startTime, now) ??
                  `Coming up in ${minutesUntilEvent(next.startTime, now)} min`}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No events have been scheduled for this day yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
