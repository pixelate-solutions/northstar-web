"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Route } from "lucide-react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCategoryLeafletIcon } from "@/components/map/categoryLeafletIcon";
import { LocationPopup } from "@/components/map/LocationPopup";
import { getCategoryConfig } from "@/lib/category-config";
import type { DaySummary } from "@/lib/types";
import { formatDateMedium, formatTimeRange } from "@/lib/utils";

type MapPin = {
  id: string;
  source: "location" | "event";
  title: string;
  category: string;
  lat: number;
  lng: number;
  locationLabel: string | null;
  description: string | null;
  tip: string | null;
  mapsHref: string;
  timeLabel: string | null;
  dayId: number;
  dayNumber: number;
  dayTitle: string;
  dayDate: string;
  locationRecord: DaySummary["locations"][number] | null;
};

interface DrivingRoute {
  distanceMeters: number;
  durationSeconds: number;
  positions: [number, number][];
}

function hasMapCoordinates(event: DaySummary["events"][number]) {
  return event.lat !== null && event.lng !== null;
}

function getPinMapLabel(pin: Pick<MapPin, "locationLabel" | "lat" | "lng">) {
  if (pin.locationLabel?.trim()) {
    return pin.locationLabel;
  }

  return `Lat ${pin.lat.toFixed(4)}, Lon ${pin.lng.toFixed(4)}`;
}

function getDirectionsHref(start: MapPin, end: MapPin) {
  const origin = `${start.lat},${start.lng}`;
  const destination = `${end.lat},${end.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function createLocationPin(day: DaySummary, location: DaySummary["locations"][number]): MapPin {
  return {
    id: `location-${location.id}`,
    source: "location",
    title: location.name,
    category: location.type,
    lat: Number(location.lat),
    lng: Number(location.lng),
    locationLabel: null,
    description: location.description,
    tip: location.tip,
    mapsHref:
      location.googleMapsUrl ??
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location.name
      )}`,
    timeLabel: null,
    dayId: day.id,
    dayNumber: day.dayNumber,
    dayTitle: day.title,
    dayDate: day.date,
    locationRecord: location,
  };
}

function createEventPin(day: DaySummary, event: DaySummary["events"][number]): MapPin {
  return {
    id: `event-${event.id}`,
    source: "event",
    title: event.title,
    category: event.category,
    lat: Number(event.lat),
    lng: Number(event.lng),
    locationLabel: event.location,
    description: event.description,
    tip: event.tip,
    mapsHref: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      event.location?.trim() ? event.location : `${event.lat},${event.lng}`
    )}`,
    timeLabel: formatTimeRange(event.startTime, event.endTime),
    dayId: day.id,
    dayNumber: day.dayNumber,
    dayTitle: day.title,
    dayDate: day.date,
    locationRecord: null,
  };
}

function getDayPins(day: DaySummary): MapPin[] {
  const eventPins = day.events
    .filter((event) => hasMapCoordinates(event))
    .map((event) => createEventPin(day, event));

  if (eventPins.length > 0) {
    return eventPins;
  }

  return day.locations.map((location) => createLocationPin(day, location));
}

function formatDriveDuration(seconds: number) {
  const roundedMinutes = Math.round(seconds / 60);
  if (roundedMinutes < 60) {
    return `${roundedMinutes} min`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function formatDriveDistance(distanceMeters: number) {
  const miles = distanceMeters * 0.000621371;
  return `${miles >= 10 ? miles.toFixed(0) : miles.toFixed(1)} mi`;
}

function MapFlyTo({
  center,
  zoom,
}: {
  center: [number, number] | null;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, Math.max(map.getZoom(), zoom), { duration: 1 });
  }, [center, map, zoom]);
  return null;
}

export function TripMapLeaflet({ days }: { days: DaySummary[] }) {
  const router = useRouter();
  const mobileCarouselRef = useRef<HTMLDivElement>(null);
  const mobileCarouselFrameRef = useRef<number | null>(null);
  const [filter, setFilter] = useState<number | "all">("all");
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [routePointIds, setRoutePointIds] = useState<string[]>([]);
  const [drivingRoute, setDrivingRoute] = useState<DrivingRoute | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "error">("idle");
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routePickerOpen, setRoutePickerOpen] = useState(false);

  const filteredDays = useMemo(
    () => days.filter((day) => filter === "all" || day.dayNumber === filter),
    [days, filter]
  );

  const filteredPins = useMemo(
    () => filteredDays.flatMap((day) => getDayPins(day)),
    [filteredDays]
  );

  const route = filteredDays
    .map((day) => getDayPins(day)[0] ?? null)
    .filter((pin): pin is MapPin => Boolean(pin))
    .map((pin) => [pin.lat, pin.lng] as [number, number]);

  const activePin = useMemo(
    () => filteredPins.find((pin) => pin.id === activePinId) ?? null,
    [activePinId, filteredPins]
  );

  const routeStart = useMemo(
    () => filteredPins.find((pin) => pin.id === routePointIds[0]) ?? null,
    [filteredPins, routePointIds]
  );
  const routeEnd = useMemo(
    () => filteredPins.find((pin) => pin.id === routePointIds[1]) ?? null,
    [filteredPins, routePointIds]
  );
  const mobileFilterIndex = useMemo(() => {
    if (filter === "all") {
      return -1;
    }

    return days.findIndex((day) => day.dayNumber === filter);
  }, [days, filter]);

  const flyTarget = useMemo<{ center: [number, number] | null; zoom: number }>(() => {
    if (activePin) {
      return {
        center: [activePin.lat, activePin.lng],
        zoom: 13,
      };
    }

    if (filter === "all") {
      return { center: null, zoom: 8 };
    }

    const day = days.find((d) => d.dayNumber === filter);
    const first = day ? getDayPins(day)[0] : null;
    if (!first) {
      return { center: null, zoom: 8 };
    }

    return {
      center: [first.lat, first.lng],
      zoom: 9,
    };
  }, [activePin, days, filter]);

  useEffect(() => {
    setRoutePointIds((current) =>
      current.filter((id) => filteredPins.some((pin) => pin.id === id))
    );
  }, [filteredPins]);

  useEffect(() => {
    if (!filteredPins.length) {
      setActivePinId(null);
      return;
    }

    setActivePinId((current) =>
      current && filteredPins.some((pin) => pin.id === current)
        ? current
        : filteredPins[0]!.id
    );
  }, [filteredPins]);

  useEffect(() => {
    const container = mobileCarouselRef.current;
    if (!container) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      container.scrollTo({ left: 0, behavior: "auto" });
    });

    return () => cancelAnimationFrame(frame);
  }, [filter]);

  useEffect(() => {
    return () => {
      if (mobileCarouselFrameRef.current !== null) {
        cancelAnimationFrame(mobileCarouselFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!routeMode || !routeStart || !routeEnd) {
      setDrivingRoute(null);
      setRouteStatus("idle");
      setRouteError(null);
      return;
    }

    const controller = new AbortController();
    const start = routeStart;
    const end = routeEnd;

    async function fetchDrivingRoute() {
      try {
        setRouteStatus("loading");
        setRouteError(null);

        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Unable to fetch route");
        }

        const data = (await response.json()) as {
          routes?: Array<{
            distance: number;
            duration: number;
            geometry?: { coordinates: [number, number][] };
          }>;
        };

        const route = data.routes?.[0];
        if (!route?.geometry?.coordinates?.length) {
          throw new Error("Route unavailable");
        }

        setDrivingRoute({
          distanceMeters: route.distance,
          durationSeconds: route.duration,
          positions: route.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number]
          ),
        });
        setRouteStatus("idle");
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setDrivingRoute(null);
        setRouteStatus("error");
        setRouteError("Unable to calculate a live driving route right now.");
      }
    }

    void fetchDrivingRoute();

    return () => controller.abort();
  }, [routeEnd, routeMode, routeStart]);

  function handlePinSelection(pinId: string) {
    setActivePinId(pinId);
  }

  function clearRoute() {
    setRouteMode(false);
    setRoutePointIds([]);
    setDrivingRoute(null);
    setRouteStatus("idle");
    setRouteError(null);
  }

  function handleRouteButtonClick() {
    setRouteMode(true);
    setRoutePickerOpen(true);
  }

  function handleRoutePointSelection(pinId: string) {
    setRouteMode(true);
    setRoutePointIds((current) => {
      if (current.length === 0) {
        return [pinId];
      }

      if (current.length === 1) {
        if (current[0] === pinId) {
          return current;
        }

        return [current[0], pinId];
      }

      if (current[0] === pinId) {
        return [pinId];
      }

      return [current[1] === pinId ? current[0]! : current[1]!, pinId];
    });
    setActivePinId(pinId);
  }

  function goToPreviousDay() {
    if (filter === "all") {
      return;
    }

    if (mobileFilterIndex <= 0) {
      setFilter("all");
      setActivePinId(null);
      return;
    }

    const previousDay = days[mobileFilterIndex - 1];
    if (!previousDay) {
      return;
    }

    setFilter(previousDay.dayNumber);
    setActivePinId(null);
  }

  function goToNextDay() {
    if (filter === "all") {
      const firstDay = days[0];
      if (!firstDay) {
        return;
      }

      setFilter(firstDay.dayNumber);
      setActivePinId(null);
      return;
    }

    const nextDay = days[mobileFilterIndex + 1];
    if (!nextDay) {
      return;
    }

    setFilter(nextDay.dayNumber);
    setActivePinId(null);
  }

  function syncActivePinFromCarousel() {
    const container = mobileCarouselRef.current;
    if (!container) {
      return;
    }

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-pin-id]")
    );
    if (!cards.length) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let closestId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenter - containerCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = card.dataset.pinId ?? null;
      }
    }

    if (closestId !== null) {
      setActivePinId((current) => (current === closestId ? current : closestId));
    }
  }

  function handleMobileCarouselScroll() {
    if (mobileCarouselFrameRef.current !== null) {
      cancelAnimationFrame(mobileCarouselFrameRef.current);
    }

    mobileCarouselFrameRef.current = requestAnimationFrame(() => {
      syncActivePinFromCarousel();
      mobileCarouselFrameRef.current = null;
    });
  }

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[0.9fr_1.4fr] lg:gap-6 lg:space-y-0">
      <div className="space-y-3 lg:hidden">
        <div className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-white/45 bg-white/72 px-3 py-2 shadow-[0_18px_42px_rgba(191,102,62,0.08)] backdrop-blur-xl">
          <button
            type="button"
            onClick={goToPreviousDay}
            disabled={filter === "all"}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/92 text-foreground shadow-[0_10px_24px_rgba(28,31,46,0.08)] transition disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (filter === "all") {
                return;
              }

              const currentDay = days.find((day) => day.dayNumber === filter);
              if (currentDay) {
                router.push(`/app/days/${currentDay.date}`);
              }
            }}
            className="min-w-0 flex-1 rounded-[1.1rem] border border-white/55 bg-white/88 px-4 py-2 text-center transition hover:bg-white disabled:pointer-events-none"
            disabled={filter === "all"}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-primary/75">
              {filter === "all" ? "Whole Trip" : "Current Day"}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {filter === "all"
                ? "All Days"
                : `Day ${filter} · ${
                    days.find((day) => day.dayNumber === filter)?.title ?? "Trip Day"
                  }`}
            </p>
          </button>

          <button
            type="button"
            onClick={goToNextDay}
            disabled={filter !== "all" && mobileFilterIndex >= days.length - 1}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/92 text-foreground shadow-[0_10px_24px_rgba(28,31,46,0.08)] transition disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next day"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-white/45 bg-white/70 px-4 py-3 shadow-[0_18px_42px_rgba(191,102,62,0.08)] backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
              {filter === "all" ? "Visible Pins" : `Day ${filter} Pins`}
            </p>
            <p className="text-sm font-medium">
              {filteredPins.length} location{filteredPins.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRouteButtonClick}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
              routeMode
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/70 bg-white text-muted-foreground hover:border-primary/25 hover:text-foreground"
            }`}
          >
            <Route className="size-4" />
            Route
          </button>
        </div>

        {routeMode ? (
          <div className="rounded-[1.35rem] border border-white/45 bg-white/68 px-4 py-3 text-sm shadow-[0_18px_42px_rgba(191,102,62,0.08)] backdrop-blur-xl">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">From:</span>{" "}
              {routeStart ? routeStart.title : "Choose a start pin"}
            </p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground">To:</span>{" "}
              {routeEnd ? routeEnd.title : "Choose a destination pin"}
            </p>
            {routeStatus === "loading" ? (
              <p className="mt-2 text-muted-foreground">Calculating drive time...</p>
            ) : null}
            {drivingRoute && routeStart && routeEnd ? (
              <div className="mt-2 space-y-1">
                <p className="font-medium text-foreground">
                  {formatDriveDuration(drivingRoute.durationSeconds)} drive
                </p>
                <p className="text-muted-foreground">
                  {formatDriveDistance(drivingRoute.distanceMeters)} via road
                </p>
                <a
                  href={getDirectionsHref(routeStart, routeEnd)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-medium text-primary"
                >
                  Open route in Maps →
                </a>
                <button
                  type="button"
                  onClick={() => setRoutePickerOpen(true)}
                  className="block font-medium text-foreground/80"
                >
                  Edit route
                </button>
              </div>
            ) : null}
            {routeError ? <p className="mt-2 text-destructive">{routeError}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="hidden space-y-4 lg:block">
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm ${
              filter === "all"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/70 bg-card/70 text-muted-foreground"
            }`}
            onClick={() => {
              setFilter("all");
              setActivePinId(null);
            }}
          >
            All Days
          </button>
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              className={`rounded-full border px-4 py-2 text-sm ${
                filter === day.dayNumber
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/70 bg-card/70 text-muted-foreground"
              }`}
              onClick={() => {
                setFilter(day.dayNumber);
                setActivePinId(null);
              }}
              onDoubleClick={() => router.push(`/app/days/${day.date}`)}
            >
              Day {day.dayNumber}
            </button>
          ))}
        </div>

        <Card className="rounded-[1.75rem] border border-border/70 bg-card/85">
          <CardContent className="space-y-4 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
                  {filter === "all" ? "Visible Pins" : `Day ${filter} Pins`}
                </p>
                <h3 className="text-lg font-semibold">
                  {filteredPins.length} location{filteredPins.length === 1 ? "" : "s"}
                </h3>
              </div>
              <Badge className="bg-secondary/70 text-foreground">
                {filter === "all" ? "Whole Trip" : `Day ${filter}`}
              </Badge>
            </div>

            <div className="rounded-[1.35rem] border border-border/70 bg-secondary/35 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Route Planner</p>
                  <p className="text-xs text-muted-foreground">
                    {routeMode
                      ? "Select two pins from the list or map."
                      : "Turn on route mode to compare two driving points."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRouteButtonClick}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                    routeMode
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 bg-white text-muted-foreground hover:border-primary/25 hover:text-foreground"
                  }`}
                >
                  <Route className="size-4" />
                  Route
                </button>
              </div>

              {routeMode ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">From:</span>{" "}
                    {routeStart ? routeStart.title : "Choose a start pin"}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">To:</span>{" "}
                    {routeEnd ? routeEnd.title : "Choose a destination pin"}
                  </p>

                  {routeStatus === "loading" ? (
                    <p className="pt-1 text-muted-foreground">
                      Calculating drive time...
                    </p>
                  ) : null}

                  {drivingRoute && routeStart && routeEnd ? (
                    <div className="space-y-2 pt-1">
                      <p className="font-medium text-foreground">
                        {formatDriveDuration(drivingRoute.durationSeconds)} drive
                      </p>
                      <p className="text-muted-foreground">
                        {formatDriveDistance(drivingRoute.distanceMeters)} via road
                      </p>
                      <a
                        href={getDirectionsHref(routeStart, routeEnd)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 font-medium text-primary"
                      >
                        Open route in Maps →
                      </a>
                      <button
                        type="button"
                        onClick={() => setRoutePickerOpen(true)}
                        className="block font-medium text-foreground/80"
                      >
                        Edit route
                      </button>
                    </div>
                  ) : null}

                  {routeError ? (
                    <p className="pt-1 text-destructive">{routeError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {filteredPins.map((pin) => {
                const config = getCategoryConfig(pin.category);
                const isActive = pin.id === activePinId;
                const isRouteSelected = routePointIds.includes(pin.id);
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => handlePinSelection(pin.id)}
                    className={`w-full rounded-[1.35rem] border p-4 text-left transition ${
                      isRouteSelected
                        ? "border-sky-400/45 bg-sky-500/10 shadow-[0_14px_30px_rgba(56,189,248,0.12)]"
                        : isActive
                        ? "border-primary/40 bg-primary/10 shadow-[0_14px_30px_rgba(255,139,94,0.14)]"
                        : "border-border/70 bg-white hover:border-primary/25 hover:bg-secondary/55"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{pin.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Day {pin.dayNumber} · {formatDateMedium(pin.dayDate)}
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-secondary text-foreground">
                        {isRouteSelected
                          ? routePointIds[0] === pin.id
                            ? "Start"
                            : "End"
                          : config.label}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {getPinMapLabel(pin)}
                    </p>
                    {pin.timeLabel ? (
                      <p className="mt-1 text-sm text-muted-foreground">{pin.timeLabel}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted-foreground">{pin.dayTitle}</p>
                    {pin.tip ? (
                      <p className="mt-2 text-sm text-muted-foreground">{pin.tip}</p>
                    ) : null}
                  </button>
                );
              })}

              {filteredPins.length === 0 ? (
                <div className="rounded-[1.35rem] border border-dashed border-border/80 bg-secondary/35 p-4 text-sm text-muted-foreground">
                  No mapped locations are available for this selection yet.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative overflow-clip rounded-[2rem] border border-border/70 lg:sticky lg:top-6 lg:self-start">
        <MapContainer
          center={route[0] ?? [36.1699, -115.1398]}
          zoom={5}
          scrollWheelZoom
          className="h-[calc(100dvh-18rem)] min-h-[28rem] w-full sm:h-[32rem] lg:h-[42rem]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFlyTo center={flyTarget.center} zoom={flyTarget.zoom} />

          {route.length > 1 ? (
            <Polyline positions={route} color="#f59e0b" weight={2} opacity={0.75} />
          ) : null}

          {drivingRoute?.positions.length ? (
            <Polyline positions={drivingRoute.positions} color="#0ea5e9" weight={4} opacity={0.85} />
          ) : null}

          {filteredDays.map((day) => {
            const hikeEventPins = day.events
              .filter(
                (event) =>
                  event.category === "hike" &&
                  event.lat !== null &&
                  event.lng !== null
              )
              .map((event) => createEventPin(day, event));
            const hikeLocationPins = day.locations
              .filter((location) => location.type === "hike")
              .map((location) => createLocationPin(day, location));
            const hikePins = hikeEventPins.length > 0 ? hikeEventPins : hikeLocationPins;

            if (hikePins.length < 2) return null;

            const positions = hikePins.map((pin) => [pin.lat, pin.lng] as [number, number]);
            return (
              <Polyline
                key={`hike-${day.id}`}
                positions={positions}
                color="#22c55e"
                weight={3}
                dashArray="9 6"
                opacity={0.9}
              >
                <Popup minWidth={180} maxWidth={260}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                    Day {day.dayNumber} Hikes
                  </p>
                  {hikePins.map((pin, i) => (
                    <div
                      key={pin.id}
                      style={{ marginBottom: i < hikePins.length - 1 ? 10 : 0 }}
                    >
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                        🥾 {pin.title}
                      </p>
                      {pin.timeLabel ? (
                        <p style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
                          {pin.timeLabel}
                        </p>
                      ) : null}
                      {pin.description ? (
                        <p style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>
                          {pin.description}
                        </p>
                      ) : null}
                      {pin.tip ? (
                        <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
                          {pin.tip}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </Popup>
              </Polyline>
            );
          })}

          {filteredDays.flatMap((day) =>
            getDayPins(day).map((pin) => (
              <Marker
                key={pin.id}
                icon={getCategoryLeafletIcon(pin.category)}
                position={[pin.lat, pin.lng]}
                eventHandlers={{
                  click: () => handlePinSelection(pin.id),
                }}
              >
                <Popup minWidth={160} maxWidth={240}>
                  {pin.locationRecord ? (
                    <div className="space-y-3">
                      <LocationPopup location={pin.locationRecord} />
                      <p style={{ fontSize: 11, color: "#888" }}>
                        Day {pin.dayNumber}: {pin.dayTitle}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                        {pin.title}
                      </p>
                      <p
                        style={{
                          fontSize: 10,
                          color: "#888",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          marginBottom: 6,
                        }}
                      >
                        {getCategoryConfig(pin.category).label}
                      </p>
                      {pin.timeLabel ? (
                        <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                          {pin.timeLabel}
                        </p>
                      ) : null}
                      <p style={{ fontSize: 13, marginBottom: 4 }}>
                        {getPinMapLabel(pin)}
                      </p>
                      {pin.description ? (
                        <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                          {pin.description}
                        </p>
                      ) : null}
                      {pin.tip ? (
                        <p style={{ fontSize: 12, color: "#666", fontStyle: "italic", marginBottom: 4 }}>
                          {pin.tip}
                        </p>
                      ) : null}
                      <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                        Day {pin.dayNumber}: {pin.dayTitle}
                      </p>
                      <a
                        href={pin.mapsHref}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}
                      >
                        Open in Maps →
                      </a>
                    </>
                  )}
                </Popup>
              </Marker>
            ))
          )}
        </MapContainer>

        <div className="absolute inset-x-0 bottom-0 z-[500] px-4 pb-4 lg:hidden">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 rounded-b-[2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(250,247,242,0.88)_68%,rgba(250,247,242,0.98)_100%)]" />
          <div className="relative">
            <div
              ref={mobileCarouselRef}
              onScroll={handleMobileCarouselScroll}
              className="scrollbar-hide min-w-0 snap-x snap-mandatory overflow-x-auto"
              style={{
                WebkitMaskImage:
                  "linear-gradient(90deg, transparent 0, black 1.5rem, black calc(100% - 1.5rem), transparent 100%)",
                maskImage:
                  "linear-gradient(90deg, transparent 0, black 1.5rem, black calc(100% - 1.5rem), transparent 100%)",
              }}
            >
              <div className="flex gap-3 pb-1">
                <div
                  aria-hidden="true"
                  className="w-[calc(50vw-5.75rem)] shrink-0"
                />
                {filteredPins.map((pin) => {
                  const isActive = pin.id === activePinId;
                  const isRouteSelected = routePointIds.includes(pin.id);
                  const config = getCategoryConfig(pin.category);

                  return (
                    <button
                      key={pin.id}
                      data-pin-id={pin.id}
                      type="button"
                      onClick={() => handlePinSelection(pin.id)}
                      className={`w-[calc(100vw-12rem)] min-w-[10.25rem] max-w-[11.5rem] shrink-0 snap-center rounded-[1.2rem] border px-3 py-2.5 text-left shadow-[0_16px_30px_rgba(28,31,46,0.12)] backdrop-blur-xl transition ${
                        isRouteSelected
                          ? "border-sky-400/55 bg-sky-100"
                          : isActive
                          ? "border-primary/45 bg-amber-50"
                          : "border-white/70 bg-white"
                      }`}
                    >
                      <p className="truncate text-sm font-medium">{pin.title}</p>
                      <p className="mt-1 truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {formatDateMedium(pin.dayDate)}
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {pin.timeLabel ?? config.label}
                      </p>
                    </button>
                  );
                })}
                <div
                  aria-hidden="true"
                  className="w-[calc(50vw-5.75rem)] shrink-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={routePickerOpen} onOpenChange={setRoutePickerOpen}>
        <DialogContent className="max-w-[calc(100%-1.25rem)] rounded-[1.5rem] border border-white/50 bg-white/95 sm:max-w-lg p-2">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>Build Route</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choose any two visible locations to compare driving time.
            </p>
          </DialogHeader>

          <div className="space-y-3 px-5 pb-4">
            <div className="grid gap-2 rounded-[1.25rem] border border-border/70 bg-secondary/30 p-3 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">From:</span>{" "}
                {routeStart ? routeStart.title : "Not selected"}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">To:</span>{" "}
                {routeEnd ? routeEnd.title : "Not selected"}
              </p>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {filteredPins.map((pin) => {
                const config = getCategoryConfig(pin.category);
                const isSelected = routePointIds.includes(pin.id);

                return (
                  <button
                    key={`route-${pin.id}`}
                    type="button"
                    onClick={() => handleRoutePointSelection(pin.id)}
                    className={`w-full rounded-[1.25rem] border p-3 text-left transition ${
                      isSelected
                        ? "border-sky-400/45 bg-sky-500/10"
                        : "border-border/70 bg-white hover:border-primary/25 hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{pin.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Day {pin.dayNumber} · {pin.timeLabel ?? config.label}
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-secondary text-foreground">
                        {isSelected
                          ? routePointIds[0] === pin.id
                            ? "Start"
                            : "End"
                          : config.label}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {getPinMapLabel(pin)}
                    </p>
                  </button>
                );
              })}

              {filteredPins.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-secondary/30 p-4 text-sm text-muted-foreground">
                  No mapped locations are available for this selection yet.
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="rounded-b-[1.5rem]">
            <button
              type="button"
              onClick={clearRoute}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-border/70 bg-white px-4 text-sm font-medium text-foreground transition hover:bg-secondary/40"
            >
              Clear route
            </button>
            <button
              type="button"
              onClick={() => setRoutePickerOpen(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
