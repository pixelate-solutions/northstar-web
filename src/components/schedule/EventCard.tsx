"use client";

import { Clock3, GripVertical, MapPin, Pencil, ReceiptText, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Event } from "@/db/schema";
import { EventCategoryBadge } from "@/components/schedule/EventCategoryBadge";
import { cn, formatCurrency, formatTimeRange, isEventActive, isEventPast } from "@/lib/utils";

interface EventCardProps {
  event: Event;
  date: string;
  sortable?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function EventCard({
  event,
  date,
  sortable = false,
  dragHandleProps,
  onOpen,
  onEdit,
  onDelete,
}: EventCardProps) {
  const active = isEventActive(event.startTime, event.endTime);
  const past = isEventPast(event.endTime, date);

  return (
    <Card
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={cn(
        "relative rounded-[1.5rem] border border-border/70 bg-card/85 transition hover:-translate-y-0.5 hover:bg-card",
        onOpen && "cursor-pointer",
        past && "opacity-60",
        active &&
          "border-red-500/40 bg-red-500/5 shadow-[0_0_0_1px_rgba(239,68,68,0.1)]"
      )}
    >
      <CardContent className="flex gap-4 py-5">
        <div className="flex flex-col items-center">
          <div className="mt-1 size-3 rounded-full bg-primary" />
          <div className="timeline-line" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{event.title}</h3>
                <EventCategoryBadge category={event.category} />
                {active ? (
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700">
                    Happening now
                  </span>
                ) : null}
              </div>
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4 text-primary" />
                {formatTimeRange(event.startTime, event.endTime)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {sortable ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Reorder ${event.title}`}
                  onClick={(clickEvent) => clickEvent.stopPropagation()}
                  {...dragHandleProps}
                >
                  <GripVertical className="size-4" />
                </Button>
              ) : null}
              {onEdit ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${event.title}`}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onEdit?.();
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${event.title}`}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onDelete?.();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {event.location ? (
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                {event.location}
              </span>
            ) : null}
            {event.cost ? (
              <span className="inline-flex items-center gap-2">
                <ReceiptText className="size-4 text-primary" />
                {formatCurrency(event.cost)}
              </span>
            ) : null}
          </div>

          {event.description ? (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          ) : null}
          {event.tip ? (
            <p className="inline-flex items-start gap-2 rounded-2xl bg-secondary/80 px-3 py-2 text-sm text-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              {event.tip}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
