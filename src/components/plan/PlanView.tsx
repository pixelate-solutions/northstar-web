"use client";

import { closestCenter, DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BedDouble, Car, ChevronDown, ChevronLeft, ChevronRight, MapPin, NotebookPen, Route, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDefaultLayout } from "react-resizable-panels";

import { StarMark } from "@/components/brand/Logo";
import { AskPanel } from "@/components/ask/AskPanel";
import { googleMapsDirectionsUrl, PlanMap, type MapPin as Pin } from "@/components/map/PlanMap";
import { Sheet } from "@/components/ns/overlay";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AddStop } from "@/components/plan/AddStop";
import { AskBar } from "@/components/plan/AskBar";
import { exportTrip, PlanActions } from "@/components/plan/PlanActions";
import { StopEditor } from "@/components/plan/StopEditor";
import { Leg, StopRow } from "@/components/plan/StopRow";
import { EditDayDialog } from "@/components/plan/TripDialogs";
import { useWeatherHigh } from "@/components/plan/useWeather";
import { TripList } from "@/components/shell/TripSwitcher";
import { useTrip } from "@/components/trip/TripProvider";
import { useRoute, type LatLng } from "@/components/trip/useRoute";
import { useHydrated, useIsDesktop } from "@/hooks/useMediaQuery";
import type { DayJson, EventJson } from "@/lib/client-types";
import { dateRange, dayChipLabel, duration, miles, shortDate, weekday } from "@/lib/format";

function coordsOf(event: { lat: string | null; lng: string | null }): LatLng | null {
  if (event.lat === null || event.lng === null) return null;
  const lat = Number(event.lat);
  const lng = Number(event.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? [lat, lng] : null;
}

function Fact({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  const className = "flex items-center gap-[7px] rounded-full bg-surface px-[11px] py-1.5 text-[14px] font-semibold whitespace-nowrap";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} transition hover:bg-line`}>
      {icon}
      {children}
    </button>
  ) : (
    <span className={className}>
      {icon}
      {children}
    </span>
  );
}

function distanceKm(a: LatLng, b: LatLng) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * One point per day for the whole-trip map: where you end the day, ignoring flights.
 * Days far from the rest (e.g. flying home) are dropped so the route stays on the trip itself.
 */
function tripAnchorPoints(days: DayJson[]) {
  const anchors = days.flatMap((d) => {
    const located = d.events
      .filter((e) => e.category !== "flight" && !/\b(airport|flight)\b/i.test(e.title))
      .map((e) => coordsOf(e))
      .filter((c): c is LatLng => Boolean(c));
    const anchor = located.at(-1);
    return anchor ? [{ day: d, coords: anchor }] : [];
  });
  if (anchors.length < 3) return anchors;
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const center: LatLng = [median(anchors.map((a) => a.coords[0])), median(anchors.map((a) => a.coords[1]))];
  return anchors.filter((a) => distanceKm(a.coords, center) < 1200);
}

/** Horizontal day pills used on mobile in place of the sidebar day list. */
function DayStrip({ activeDate }: { activeDate: string | null }) {
  const { bundle } = useTrip();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeDate]);
  return (
    <div ref={ref} className="scrollbar-hide flex gap-1.5 overflow-x-auto px-4 pb-3.5 lg:hidden">
      <Link
        href="/app"
        data-active={!activeDate}
        className={`flex h-9 shrink-0 items-center justify-center rounded-full px-3 ${!activeDate ? "bg-lane" : "bg-surface"}`}
        aria-label="Whole trip"
      >
        <Route size={15} strokeWidth={2.2} />
      </Link>
      {bundle.days.map((day) => {
        const active = day.date === activeDate;
        return (
          <Link
            key={day.id}
            href={`/app/days/${day.date}`}
            data-active={active}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[13px] ${
              active ? "bg-lane font-bold" : "bg-surface font-semibold"
            }`}
          >
            {day.dayNumber}
          </Link>
        );
      })}
    </div>
  );
}

function DayColumn({
  day,
  selectedId,
  setSelectedId,
  route,
}: {
  day: DayJson;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  route: ReturnType<typeof useRoute>;
}) {
  const { bundle, canEdit, reorderEvents, highlightedEventIds } = useTrip();
  const [dragging, setDragging] = useState(false);
  const [editDayOpen, setEditDayOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } })
  );
  const index = bundle.days.findIndex((item) => item.id === day.id);
  const prev = bundle.days[index - 1];
  const next = bundle.days[index + 1];
  const stops = day.events;
  const coords = stops.map(coordsOf);
  const center = useMemo(() => {
    const found = coords.filter((c): c is LatLng => Boolean(c));
    if (!found.length) return null;
    return { lat: found.reduce((s, c) => s + c[0], 0) / found.length, lng: found.reduce((s, c) => s + c[1], 0) / found.length };
  }, [coords]);

  // Map each consecutive pair of located stops to its OSRM leg.
  const legLabels = useMemo(() => {
    const labels = new Map<number, { label: string; drive: boolean }>();
    if (!route) return labels;
    let pointIndex = -1;
    let previousLocated: number | null = null;
    stops.forEach((_, i) => {
      if (!coords[i]) return;
      pointIndex += 1;
      if (previousLocated !== null && previousLocated === i - 1) {
        const leg = route.legs[pointIndex - 1];
        if (leg) labels.set(i - 1, { label: `${duration(leg.duration)}${leg.duration > 30 * 60 ? " drive" : ""}`, drive: leg.duration > 30 * 60 });
      }
      previousLocated = i;
    });
    return labels;
  }, [route, stops, coords]);

  const weatherHigh = useWeatherHigh(day.location || stops.find((s) => s.location)?.location || null);
  const sleep = day.sleepLocation || [...stops].reverse().find((s) => s.category === "accommodation")?.title || null;

  function onDragEnd(event: DragEndEvent) {
    setDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = stops.map((s) => s.id);
    const moved = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    void reorderEvents(day.id, moved);
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-5 pb-4 pt-1 sm:gap-[18px] lg:px-9 lg:pb-6 lg:pt-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Link
              href={prev ? `/app/days/${prev.date}` : "/app"}
              aria-label="Previous day"
              className="hidden h-8 w-8 items-center justify-center rounded-full border border-line hover:bg-surface lg:flex"
            >
              <ChevronLeft size={16} strokeWidth={2.2} />
            </Link>
            <Link
              href={next ? `/app/days/${next.date}` : "/app"}
              aria-label="Next day"
              className="hidden h-8 w-8 items-center justify-center rounded-full border border-line hover:bg-surface lg:flex"
            >
              <ChevronRight size={16} strokeWidth={2.2} />
            </Link>
            <span className="font-mono text-[12px] font-medium uppercase text-muted lg:pl-2 lg:text-[13px]">
              Day {day.dayNumber} · {weekday(day.date)} {shortDate(day.date).toUpperCase()}
            </span>
          </div>
          <PlanActions day={day} />
        </div>
        <button
          type="button"
          onClick={() => setEditDayOpen(true)}
          className="text-left text-[32px] font-extrabold leading-[34px] tracking-display lg:text-[44px] lg:leading-[46px]"
        >
          {day.title || day.location || `Day ${day.dayNumber}`}
        </button>
        <div className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
          {weatherHigh !== null ? <Fact icon={<Sun size={15} strokeWidth={2} />}>{weatherHigh}°</Fact> : null}
          {route && route.duration > 0 ? (
            <Fact icon={<Car size={15} strokeWidth={2} />}>
              {duration(route.duration)} · {miles(route.distance)}
            </Fact>
          ) : null}
          {sleep ? <Fact icon={<BedDouble size={15} strokeWidth={2} />}>{sleep}</Fact> : null}
          {day.notes ? (
            <Fact icon={<NotebookPen size={15} strokeWidth={2} />} onClick={() => setEditDayOpen(true)}>
              Day notes
            </Fact>
          ) : null}
        </div>
      </div>
      <EditDayDialog day={day} open={editDayOpen} onClose={() => setEditDayOpen(false)} />

      <div className="flex flex-col px-3 lg:px-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setDragging(true)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(false)}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {stops.map((event, i) => (
              <div key={event.id}>
                {selectedId === event.id ? (
                  <StopEditor key={event.id} event={event} number={i + 1} near={center} onClose={() => setSelectedId(null)} />
                ) : (
                  <StopRow
                    event={event}
                    number={i + 1}
                    selected={false}
                    highlighted={highlightedEventIds.has(event.id)}
                    draggable={canEdit && event.id > 0}
                    onClick={() => setSelectedId(event.id)}
                  />
                )}
                {i < stops.length - 1 && !dragging ? <Leg label={legLabels.get(i)?.label ?? null} drive={legLabels.get(i)?.drive} /> : null}
              </div>
            ))}
          </SortableContext>
        </DndContext>
        {canEdit ? <AddStop dayId={day.id} near={center} onAdded={(id) => setSelectedId(id)} /> : null}
        {!stops.length && !canEdit ? <p className="px-3 py-6 text-[15px] font-medium text-muted">Nothing planned yet.</p> : null}
      </div>
    </>
  );
}

function TripColumn() {
  const { bundle, canEdit, openAsk } = useTrip();
  const stopCount = bundle.days.reduce((sum, day) => sum + day.events.length, 0);
  const bookedNights = bundle.days.filter((day) => day.events.some((e) => e.category === "accommodation" && e.isBooked)).length;

  return (
    <>
      <div className="flex flex-col gap-3 px-5 pb-4 pt-1 sm:gap-[18px] lg:px-9 lg:pb-6 lg:pt-7">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] font-medium uppercase text-muted lg:text-[13px]">
            {bundle.days.length} days · {dateRange(bundle.trip.startDate, bundle.trip.endDate).toUpperCase()}
          </span>
          <PlanActions />
        </div>
        <h1 className="text-[32px] font-extrabold leading-[34px] tracking-display lg:text-[44px] lg:leading-[46px]">{bundle.trip.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Fact icon={<MapPin size={15} strokeWidth={2} />}>{stopCount} stops</Fact>
          {bookedNights ? <Fact icon={<BedDouble size={15} strokeWidth={2} />}>{bookedNights} nights booked</Fact> : null}
        </div>
      </div>
      <div className="flex flex-col px-3 lg:px-6">
        {bundle.days.map((day) => {
          const empty = day.events.length === 0;
          return (
            <div
              key={day.id}
              className="relative flex h-[44px] items-center gap-3 rounded-[10px] px-3 transition hover:bg-surface sm:gap-3.5"
            >
              {/* The whole row opens the day; "Plan this day" sits above the link. */}
              <Link href={`/app/days/${day.date}`} aria-label={`Day ${day.dayNumber}`} className="absolute inset-0 rounded-[10px]" />
              <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-3 sm:gap-3.5">
                <span className="w-11 shrink-0 font-mono text-[12px] font-medium text-muted">{dayChipLabel(day.date)}</span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                    empty ? "border-[1.5px] border-dashed border-[#9E9E98]" : "bg-ink text-white"
                  }`}
                >
                  {day.dayNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{day.title || day.location || `Day ${day.dayNumber}`}</span>
              </div>
              {empty && canEdit ? (
                <button
                  type="button"
                  onClick={() =>
                    openAsk(
                      `Plan Day ${day.dayNumber} (${shortDate(day.date)})${day.location ? ` in ${day.location}` : ""} with specific places, times, and drive times.`,
                      true
                    )
                  }
                  className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-bold hover:bg-white"
                >
                  <StarMark size={13} core={null} /> Plan this day
                </button>
              ) : (
                <span className="pointer-events-none flex w-[92px] shrink-0 items-center gap-[3px]">
                  {day.events.slice(0, 9).map((event) => (
                    <span key={event.id} className="h-[7px] w-[7px] shrink-0 rounded-full bg-ink" />
                  ))}
                  {day.events.length > 9 ? <span className="pl-0.5 font-mono text-[11px] font-semibold text-muted">+{day.events.length - 9}</span> : null}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function MobileTripSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="pt-2">
        <TripList onDone={onClose} />
        <button
          type="button"
          onClick={() => {
            onClose();
            exportTrip();
          }}
          className="mt-2 w-full rounded-[14px] bg-surface py-3 text-[14px] font-semibold"
        >
          Export trip
        </button>
      </div>
    </Sheet>
  );
}

/** Saved list/map split; safe during server rendering. */
const layoutStorage = {
  getItem: (key: string) => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
};

export function PlanView({ date }: { date: string | null }) {
  const { bundle, ask, highlightedEventIds } = useTrip();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "northstar-plan", storage: layoutStorage });
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const hydrated = useHydrated();
  // Selection is scoped to the day it was made on, so switching days clears it without an effect.
  const [selection, setSelection] = useState<{ date: string | null; id: number | null }>({ date, id: null });
  const selectedId = selection.date === date ? selection.id : null;
  const setSelectedId = (id: number | null) => setSelection({ date, id });
  const [tripSheet, setTripSheet] = useState(false);
  const day = date ? bundle.days.find((item) => item.date === date) ?? null : null;

  // Day view: stops in order. Trip view: one anchor per day (where you end up).
  const dayPoints: Array<{ event: EventJson; number: number; coords: LatLng }> = day
    ? day.events.flatMap((event, i) => {
        const c = coordsOf(event);
        return c ? [{ event, number: i + 1, coords: c }] : [];
      })
    : [];
  const tripAnchors = !day ? tripAnchorPoints(bundle.days) : [];

  const routePoints = day ? dayPoints.map((p) => p.coords) : tripAnchors.map((a) => a.coords);
  const route = useRoute(routePoints);

  const pins: Pin[] = day
    ? dayPoints.map((p) => ({
        id: p.event.id,
        lat: p.coords[0],
        lng: p.coords[1],
        label: String(p.number),
        title: p.event.title,
        highlighted: highlightedEventIds.has(p.event.id),
      }))
    : tripAnchors.map((a, i) => ({
        id: a.day.id,
        lat: a.coords[0],
        lng: a.coords[1],
        label: String(a.day.dayNumber),
        title: a.day.title || a.day.location || `Day ${a.day.dayNumber}`,
        showTitle: tripAnchors.length <= 8 || i === 0 || i === tripAnchors.length - 1,
      }));

  const extraPins = day
    ? day.locations
        .map((l) => ({ id: l.id, lat: Number(l.lat), lng: Number(l.lng), title: l.name }))
        .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng))
    : [];

  const mapsUrl = googleMapsDirectionsUrl(routePoints.map(([lat, lng]) => ({ lat, lng })));

  if (date && !day) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-[18px] font-bold">That day isn&apos;t in this trip.</p>
        <Link href="/app" className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-bold text-white">
          Back to the trip
        </Link>
      </div>
    );
  }

  if (!hydrated) return <div className="h-full bg-white" />;

  const mapArea = (
    <>
      {isDesktop && ask.open ? (
        <AskPanel />
      ) : (
        <PlanMap
          pins={pins}
          extraPins={extraPins}
          route={route?.coordinates ?? null}
          selectedId={day ? selectedId : null}
          onSelect={(id) => (day ? setSelectedId(id) : router.push(`/app/days/${bundle.days.find((d) => d.id === id)?.date}`))}
          mapsUrl={isDesktop ? mapsUrl : null}
        />
      )}
    </>
  );

  const listArea = (
    <>
      <div className="flex justify-center pb-2.5 pt-2 lg:hidden">
        <div className="h-[5px] w-9 rounded-full bg-[#D6D6D2]" />
      </div>
      <DayStrip activeDate={day?.date ?? null} />
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {day ? <DayColumn day={day} selectedId={selectedId} setSelectedId={setSelectedId} route={route} /> : <TripColumn />}
        <div className="h-6 shrink-0" />
      </div>
      <AskBar />
    </>
  );

  // Desktop: list and map side by side with a draggable divider.
  if (isDesktop) {
    return (
      <div className="flex h-full overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
          <ResizablePanel id="list" defaultSize="42" minSize="400px" maxSize="70">
            <section className="relative flex h-full min-h-0 flex-col bg-white">{listArea}</section>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="map" minSize="25">
            <div className="relative h-full">{mapArea}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-0 h-[40dvh] min-h-[260px] shrink-0">
        {mapArea}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
          <button
            type="button"
            onClick={() => setTripSheet(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3 shadow-float"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink">
              <StarMark size={13} color="#FFC500" core={null} />
            </span>
            <span className="max-w-[200px] truncate text-[15px] font-bold">{bundle.trip.name}</span>
            <ChevronDown size={14} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <section className="relative z-10 -mt-6 flex min-h-[66dvh] shrink-0 flex-col rounded-t-[24px] bg-white pb-28 shadow-[0_-4px_20px_rgba(17,17,16,0.08)]">
        {listArea}
      </section>
      <MobileTripSheet open={tripSheet} onClose={() => setTripSheet(false)} />
    </div>
  );
}
