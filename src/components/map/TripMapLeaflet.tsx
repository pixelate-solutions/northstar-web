"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getCategoryConfig } from "@/lib/category-config";
import type { DaySummary } from "@/lib/types";
import { formatDateMedium } from "@/lib/utils";

function MapFlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, Math.max(map.getZoom(), 8), { duration: 1 });
  }, [center, map]);
  return null;
}

export function TripMapLeaflet({ days }: { days: DaySummary[] }) {
  const [filter, setFilter] = useState<number | "all">("all");

  const filteredDays = useMemo(
    () => days.filter((day) => filter === "all" || day.dayNumber === filter),
    [days, filter]
  );

  const route = filteredDays
    .map((day) => day.locations[0])
    .filter(Boolean)
    .map((location) => [Number(location.lat), Number(location.lng)] as [number, number]);

  const flyToCenter = useMemo<[number, number] | null>(() => {
    if (filter === "all") return null;
    const day = days.find((d) => d.dayNumber === filter);
    const first = day?.locations[0];
    if (!first) return null;
    return [Number(first.lat), Number(first.lng)];
  }, [filter, days]);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm ${
              filter === "all"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/70 bg-card/70 text-muted-foreground"
            }`}
            onClick={() => setFilter("all")}
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
              onClick={() => setFilter(day.dayNumber)}
            >
              Day {day.dayNumber}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredDays.map((day, index) => (
            <Card key={day.id} className="rounded-[1.75rem] border border-border/70 bg-card/80">
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-primary/80">
                      {formatDateMedium(day.date)}
                    </p>
                    <h3 className="text-lg font-semibold">{day.title}</h3>
                  </div>
                  <Badge className="bg-secondary/70 text-foreground">
                    {day.location}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {day.driveInfo ?? "No drive summary available."}
                </p>
                {index < filteredDays.length - 1 ? (
                  <p className="text-xs text-muted-foreground">
                    Next stop: {filteredDays[index + 1]?.location}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-border/70">
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
          <MapFlyTo center={flyToCenter} />

          {route.length > 1 ? (
            <Polyline positions={route} color="#f59e0b" weight={2} opacity={0.75} />
          ) : null}

          {filteredDays.map((day) => {
            const hikeLocations = day.locations.filter((loc) => loc.type === "hike");
            if (hikeLocations.length < 2) return null;
            const positions = hikeLocations.map(
              (loc) => [Number(loc.lat), Number(loc.lng)] as [number, number]
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
                  {hikeLocations.map((loc, i) => (
                    <div
                      key={loc.id}
                      style={{ marginBottom: i < hikeLocations.length - 1 ? 10 : 0 }}
                    >
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                        🥾 {loc.name}
                      </p>
                      {loc.description ? (
                        <p style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>
                          {loc.description}
                        </p>
                      ) : null}
                      {loc.tip ? (
                        <p style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
                          {loc.tip}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </Popup>
              </Polyline>
            );
          })}

          {filteredDays.map((day) =>
            day.locations.map((location) => (
              <Marker
                key={location.id}
                position={[Number(location.lat), Number(location.lng)]}
              >
                <Popup minWidth={160} maxWidth={240}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                    {location.name}
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
                    {getCategoryConfig(location.type).label}
                  </p>
                  {location.description ? (
                    <p style={{ fontSize: 13, marginBottom: 4 }}>{location.description}</p>
                  ) : null}
                  {location.tip ? (
                    <p style={{ fontSize: 12, color: "#666", fontStyle: "italic", marginBottom: 4 }}>
                      {location.tip}
                    </p>
                  ) : null}
                  {location.googleMapsUrl ? (
                    <a
                      href={location.googleMapsUrl}
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
