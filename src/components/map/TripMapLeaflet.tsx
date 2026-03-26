"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

  const filteredDays = useMemo(
    () => days.filter((day) => filter === "all" || day.dayNumber === filter),
    [days, filter]
  );

  const filteredPins = useMemo(
    () =>
      filteredDays.flatMap((day) =>
        day.events
          .filter(
            (event) =>
              Boolean(event.location) &&
              event.lat !== null &&
              event.lng !== null
          )
          .map((event) => ({
            ...event,
            dayId: day.id,
            dayNumber: day.dayNumber,
            dayTitle: day.title,
            dayDate: day.date,
          }))
      ),
    [filteredDays]
  );

  const route = filteredDays
    .map((day) =>
      day.events.find(
        (event) =>
          Boolean(event.location) &&
          event.lat !== null &&
          event.lng !== null
      )
    )
    .filter(
      (event): event is NonNullable<typeof event> => Boolean(event)
    )
    .map((event) => [Number(event.lat), Number(event.lng)] as [number, number]);

  const activePin = useMemo(
    () => filteredPins.find((event) => event.id === activeEventId) ?? null,
    [activeEventId, filteredPins]
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
    const first = day?.events.find(
      (event) =>
        Boolean(event.location) &&
        event.lat !== null &&
        event.lng !== null
    );
    if (!first) {
      return { center: null, zoom: 8 };
    }

    return {
      center: [Number(first.lat), Number(first.lng)],
      zoom: 9,
    };
  }, [activePin, days, filter]);

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
            <div className="flex items-center justify-between gap-3">
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

            <div className="space-y-3">
              {filteredPins.map((event) => {
                const config = getCategoryConfig(event.category);
                const isActive = event.id === activeEventId;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setActiveEventId(event.id)}
                    className={`w-full rounded-[1.35rem] border p-4 text-left transition ${
                      isActive
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
                        {config.label}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {event.location}
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
              .filter(
                (event) =>
                  Boolean(event.location) &&
                  event.lat !== null &&
                  event.lng !== null
              )
              .map((event) => (
              <Marker
                key={event.id}
                icon={getCategoryLeafletIcon(event.category)}
                position={[Number(event.lat), Number(event.lng)]}
                eventHandlers={{
                  click: () => setActiveEventId(event.id),
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
                  {event.location ? (
                    <p style={{ fontSize: 13, marginBottom: 4 }}>{event.location}</p>
                  ) : null}
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
                  {event.location ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}
                    >
                      Open in Maps →
                    </a>
                  ) : null}
                </Popup>
              </Marker>
            ))
          )}
        </MapContainer>
      </div>
    </div>
  );
}
