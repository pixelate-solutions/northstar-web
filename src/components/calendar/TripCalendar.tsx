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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DaySummary } from "@/lib/types";
import { getCategoryConfig } from "@/lib/category-config";
import {
  formatDate,
  formatDateShort,
  formatTimeRange,
  sortEventsByTime,
} from "@/lib/utils";

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

function getInitialCalendarDate(days: DaySummary[]) {
  const firstTripDate = days[0]?.date;
  return firstTripDate ? new Date(`${firstTripDate}T00:00:00`) : new Date();
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
  const [calendarDate, setCalendarDate] = useState(() => getInitialCalendarDate(days));
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

  function selectDay(day: DaySummary) {
    setSelectedDayId(day.id);
    setSelectedEvent(null);
    setCalendarDate(new Date(`${day.date}T00:00:00`));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {canEdit ? (
          <Button className="w-full sm:w-auto" onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />
            Add Event
          </Button>
        ) : null}
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
              {selectedDay ? (
                <Select
                  value={selectedDay.date}
                  onValueChange={(date) => {
                    const day = days.find((item) => item.date === date);
                    if (day) {
                      selectDay(day);
                    }
                  }}
                  disabled={days.length <= 1}
                >
                  <SelectTrigger className="h-auto max-w-full rounded-full border-0 bg-secondary px-4 py-2 text-base font-semibold text-foreground shadow-none hover:bg-secondary/80 focus-visible:ring-primary/20 data-[size=default]:h-auto">
                    <SelectValue>{formatDate(selectedDay.date)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    alignItemWithTrigger={false}
                    className="max-h-72 min-w-64 overflow-y-auto"
                  >
                    {days.map((day) => (
                      <SelectItem
                        key={day.id}
                        value={day.date}
                        className="hover:cursor-pointer hover:bg-accent/10 focus:bg-accent/10 focus:text-foreground"
                      >
                        <span className="flex min-w-0 flex-col items-start gap-0.5">
                          <span className="font-medium">
                            Day {day.dayNumber} · {formatDateShort(day.date)}
                          </span>
                          <span className="max-w-56 truncate text-xs text-muted-foreground">
                            {day.title}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                "Day Summary"
              )}
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
              {selectedDay
                ? sortEventsByTime(selectedDay.events).map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-border/60 bg-secondary/35 p-4"
                    >
                      <p className="font-medium">{event.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatTimeRange(event.startTime, event.endTime)}
                      </p>
                    </div>
                  ))
                : null}
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
