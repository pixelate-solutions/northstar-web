"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type Event as CalendarEvent,
  type View,
} from "react-big-calendar";
import {
  format,
  getDay,
  parse,
  startOfWeek,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { CalendarEventItem } from "@/components/calendar/CalendarEventItem";
import { EventModal } from "@/components/schedule/EventModal";
import { MobileDayNavigator } from "@/components/shared/MobileDayNavigator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DaySummary } from "@/lib/types";
import { getCategoryConfig } from "@/lib/category-config";
import { formatDate, formatDateShort, formatTimeRange } from "@/lib/utils";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type TripCalendarEvent = CalendarEvent & {
  resource: {
    dayId: number;
    dayDate: string;
    category: string;
    location?: string | null;
    description?: string | null;
  };
};

function subscribeToViewport(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function getIsMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

export function TripCalendar({
  days,
  canEdit = true,
}: {
  days: DaySummary[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const isMobileViewport = useSyncExternalStore(
    subscribeToViewport,
    getIsMobileViewport,
    () => false
  );
  const [selectedDayId, setSelectedDayId] = useState(days[0]?.id ?? 1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TripCalendarEvent | null>(null);
  const [desktopView, setDesktopView] = useState<View>("month");
  const [calendarDate, setCalendarDate] = useState(new Date("2026-04-08T00:00:00"));
  const view = isMobileViewport ? "agenda" : desktopView;

  const calendarEvents = useMemo<TripCalendarEvent[]>(
    () =>
      days.flatMap((day) =>
        day.events.map((event) => ({
          title: event.title,
          start: new Date(`${day.date}T${event.startTime ?? "00:00:00"}`),
          end: new Date(`${day.date}T${event.endTime ?? event.startTime ?? "00:30:00"}`),
          resource: {
            dayId: day.id,
            dayDate: day.date,
            category: event.category,
            location: event.location,
            description: event.description,
          },
        }))
      ).sort((a, b) => a.start.getTime() - b.start.getTime()),
    [days]
  );

  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0];
  const selectedDayIndex = days.findIndex((day) => day.id === selectedDayId);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <MobileDayNavigator
          className="sm:hidden"
          days={days}
          selectedIndex={selectedDayIndex >= 0 ? selectedDayIndex : 0}
          onSelectIndex={(index) => {
            if (index === null) {
              return;
            }

            const day = days[index];
            if (day) {
              setSelectedDayId(day.id);
            }
          }}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden flex-wrap gap-2 sm:flex">
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => {
                setSelectedDayId(day.id);
              }}
              onDoubleClick={() => router.push(`/app/days/${day.date}`)}
              className={`rounded-full border px-4 py-2 text-sm ${
                day.id === selectedDayId
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/70 bg-card/70 text-muted-foreground"
              }`}
            >
              {formatDateShort(day.date)}
            </button>
          ))}
        </div>
        {canEdit ? (
          <Button className="w-full sm:w-auto" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />
            Add Event
          </Button>
        ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="overflow-x-auto rounded-[2rem] border border-border/70 bg-card/80 p-4 shadow-[0_12px_40px_rgba(157,124,74,0.08)]">
          <div className="h-[460px] min-w-[320px] sm:h-[600px] lg:h-[740px]">
          <Calendar
            className="trip-calendar p-2"
            localizer={localizer}
            events={calendarEvents}
            date={calendarDate}
            onNavigate={(d) => setCalendarDate(d)}
            startAccessor="start"
            endAccessor="end"
            titleAccessor={(event) => String(event.title ?? "")}
            view={view}
            onView={(nextView) => {
              if (!isMobileViewport) {
                setDesktopView(nextView);
              }
            }}
            selectable
            popup
            showAllEvents
            style={{ height: "100%" }}
            onSelectEvent={(event) => {
              setSelectedDayId(event.resource.dayId);
              setSelectedEvent(event);
            }}
            onSelectSlot={(slotInfo) => {
              const selected = days.find(
                (day) =>
                  format(day.date ? new Date(`${day.date}T00:00:00`) : new Date(), "yyyy-MM-dd") ===
                  format(slotInfo.start, "yyyy-MM-dd")
              );
              if (selected) {
                setSelectedDayId(selected.id);
              }
            }}
            views={["month", "week", "agenda"]}
            eventPropGetter={(event) => {
              const config = getCategoryConfig(event.resource.category);
              return {
                style: {
                  backgroundColor: config.color,
                  borderRadius: "12px",
                  border: "none",
                  color: "#fff",
                  padding: "2px 6px",
                },
              };
            }}
            components={{
              event: ({ event }) => (
                <CalendarEventItem
                  category={event.resource.category}
                  title={String(event.title ?? "")}
                />
              ),
            }}
          />
          </div>
        </div>

        <Card className="rounded-[2rem] border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>
              {selectedDay ? formatDate(selectedDay.date) : "Day Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedEvent ? (
              <div className="rounded-2xl bg-secondary/50 p-4">
                <p className="text-lg font-semibold">{selectedEvent.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatTimeRange(
                    selectedEvent.start ? format(selectedEvent.start, "HH:mm") : "",
                    selectedEvent.end ? format(selectedEvent.end, "HH:mm") : ""
                  )}
                </p>
                {selectedEvent.resource.location ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedEvent.resource.location}
                  </p>
                ) : null}
                {selectedEvent.resource.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedEvent.resource.description}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              {selectedDay?.events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-border/60 bg-secondary/35 p-4"
                >
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatTimeRange(event.startTime, event.endTime)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {canEdit ? (
        <EventModal
          key={`calendar-${selectedDayId}-${modalOpen ? "open" : "closed"}`}
          dayId={selectedDayId}
          date={selectedDay?.date}
          open={modalOpen}
          onOpenChange={setModalOpen}
          nextSortOrder={(selectedDay?.events.length ?? 0) + 1}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
