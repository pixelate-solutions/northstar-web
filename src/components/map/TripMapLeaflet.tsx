"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Route } from "lucide-react";
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
import { getCategoryLeafletIcon } from "@/components/map/categoryLeafletIcon";
import { getCategoryConfig } from "@/lib/category-config";
import type { DaySummary } from "@/lib/types";
import { formatDateMedium, formatTimeRange } from "@/lib/utils";

type MapEventPin = DaySummary["events"][number] & {
  dayId: number;
  dayNumber: number;
  dayTitle: string;
  dayDate: string;
};

interface DrivingRoute {
  distanceMeters: number;
  durationSeconds: number;
  positions: [number, number][];
}

function hasMapCoordinates(event: DaySummary["events"][number]) {
  return event.lat !== null && event.lng !== null;
}

function getEventMapLabel(event: Pick<DaySummary["events"][number], "location" | "lat" | "lng">) {
  if (event.location?.trim()) {
    return event.location;
  }

  return `Lat ${Number(event.lat).toFixed(4)}, Lon ${Number(event.lng).toFixed(4)}`;
}

function getEventMapsHref(event: Pick<DaySummary["events"][number], "location" | "lat" | "lng">) {
  const query = event.location?.trim()
    ? event.location
    : `${event.lat},${event.lng}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getDirectionsHref(start: MapEventPin, end: MapEventPin) {
  const origin = `${start.lat},${start.lng}`;
  const destination = `${end.lat},${end.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
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
  const [filter, setFilter] = useState<number | "all">("all");
  const [activeEventId, setActiveEventId] = useState<number | null>(null);
  const [routeMode, setRouteMode] = useState(false);
  const [routePointIds, setRoutePointIds] = useState<number[]>([]);
  const [drivingRoute, setDrivingRoute] = useState<DrivingRoute | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "error">("idle");
  const [routeError, setRouteError] = useState<string | null>(null);

  const filteredDays = useMemo(
    () => days.filter((day) => filter === "all" || day.dayNumber === filter),
    [days, filter]
  );

  const filteredPins = useMemo(
    () =>
      filteredDays.flatMap((day) =>
        day.events
          .filter((event) => hasMapCoordinates(event))
          .map((event) => ({
            ...event,
            dayId: day.id,
            dayNumber: day.dayNumber,
            dayTitle: day.title,
            dayDate: day.date,
          }) satisfies MapEventPin)
      ),
    [filteredDays]
  );

  const route = filteredDays
    .map((day) => day.events.find((event) => hasMapCoordinates(event)))
    .filter(
      (event): event is NonNullable<typeof event> => Boolean(event)
    )
    .map((event) => [Number(event.lat), Number(event.lng)] as [number, number]);

  const activePin = useMemo(
    () => filteredPins.find((event) => event.id === activeEventId) ?? null,
    [activeEventId, filteredPins]
  );

  const routeStart = useMemo(
    () => filteredPins.find((event) => event.id === routePointIds[0]) ?? null,
    [filteredPins, routePointIds]
  );
  const routeEnd = useMemo(
    () => filteredPins.find((event) => event.id === routePointIds[1]) ?? null,
    [filteredPins, routePointIds]
  );

  const flyTarget = useMemo<{ center: [number, number] | null; zoom: number }>(() => {
    if (activePin) {
      return {
        center: [Number(activePin.lat), Number(activePin.lng)],
        zoom: 13,
      };
    }

    if (filter === "all") {
      return { center: null, zoom: 8 };
    }

    const day = days.find((d) => d.dayNumber === filter);
    const first = day?.events.find((event) => hasMapCoordinates(event));
    if (!first) {
      return { center: null, zoom: 8 };
    }

    return {
      center: [Number(first.lat), Number(first.lng)],
      zoom: 9,
    };
  }, [activePin, days, filter]);

  useEffect(() => {
    setRoutePointIds((current) =>
      current.filter((id) => filteredPins.some((event) => event.id === id))
    );
  }, [filteredPins]);

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

  function handlePinSelection(eventId: number) {
    setActiveEventId(eventId);

    if (!routeMode) {
      return;
    }

    setRoutePointIds((current) => {
      if (current.includes(eventId)) {
        return current.filter((id) => id !== eventId);
      }

      if (current.length >= 2) {
        return [current[1]!, eventId];
      }

      return [...current, eventId];
    });
  }

  function toggleRouteMode() {
    setRouteMode((current) => {
      if (current) {
        setRoutePointIds([]);
        setDrivingRoute(null);
        setRouteStatus("idle");
        setRouteError(null);
      }
      return !current;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
      <div className="space-y-4">
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
              setActiveEventId(null);
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
                setActiveEventId(null);
              }}
              onDoubleClick={() => router.push(`/days/${day.date}`)}
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
                  onClick={toggleRouteMode}
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
                    </div>
                  ) : null}

                  {routeError ? (
                    <p className="pt-1 text-destructive">{routeError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {filteredPins.map((event) => {
                const config = getCategoryConfig(event.category);
                const isActive = event.id === activeEventId;
                const isRouteSelected = routePointIds.includes(event.id);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handlePinSelection(event.id)}
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
                        <p className="font-medium">{event.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Day {event.dayNumber} · {formatDateMedium(event.dayDate)}
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-secondary text-foreground">
                        {isRouteSelected
                          ? routePointIds[0] === event.id
                            ? "Start"
                            : "End"
                          : config.label}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {getEventMapLabel(event)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatTimeRange(event.startTime, event.endTime)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{event.dayTitle}</p>
                    {event.tip ? (
                      <p className="mt-2 text-sm text-muted-foreground">{event.tip}</p>
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

      <div className="rounded-[2rem] border border-border/70 lg:sticky lg:top-6 lg:self-start overflow-clip">
        <MapContainer
          center={route[0] ?? [36.1699, -115.1398]}
          zoom={5}
          scrollWheelZoom
          className="h-64 w-full sm:h-[32rem] lg:h-[42rem]"
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
            const hikeEvents = day.events.filter(
              (event) =>
                event.category === "hike" &&
                event.lat !== null &&
                event.lng !== null
            );
            if (hikeEvents.length < 2) return null;
            const positions = hikeEvents.map(
              (event) => [Number(event.lat), Number(event.lng)] as [number, number]
            );
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
                  {hikeEvents.map((event, i) => (
                    <div
                      key={event.id}
                      style={{ marginBottom: i < hikeEvents.length - 1 ? 10 : 0 }}
                    >
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                        🥾 {event.title}
                      </p>
                      <p style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
                        {formatTimeRange(event.startTime, event.endTime)}
                      </p>
                      {event.description ? (
                        <p style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>
                          {event.description}
                        </p>
                      ) : null}
                      {event.tip ? (
                        <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
                          {event.tip}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </Popup>
              </Polyline>
            );
          })}

          {filteredDays.map((day) =>
            day.events
              .filter((event) => hasMapCoordinates(event))
              .map((event) => (
              <Marker
                key={event.id}
                icon={getCategoryLeafletIcon(event.category)}
                position={[Number(event.lat), Number(event.lng)]}
                eventHandlers={{
                  click: () => handlePinSelection(event.id),
                }}
              >
                <Popup minWidth={160} maxWidth={240}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                    {event.title}
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
                    {getCategoryConfig(event.category).label}
                  </p>
                  <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                    {formatTimeRange(event.startTime, event.endTime)}
                  </p>
                  <p style={{ fontSize: 13, marginBottom: 4 }}>
                    {getEventMapLabel(event)}
                  </p>
                  {event.description ? (
                    <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                      {event.description}
                    </p>
                  ) : null}
                  {event.tip ? (
                    <p style={{ fontSize: 12, color: "#666", fontStyle: "italic", marginBottom: 4 }}>
                      {event.tip}
                    </p>
                  ) : null}
                  {day.title ? (
                    <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                      Day {day.dayNumber}: {day.title}
                    </p>
                  ) : null}
                  <a
                    href={getEventMapsHref(event)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}
                  >
                    Open in Maps →
                  </a>
                </Popup>
              </Marker>
            ))
          )}
        </MapContainer>
      </div>
    </div>
  );
}
