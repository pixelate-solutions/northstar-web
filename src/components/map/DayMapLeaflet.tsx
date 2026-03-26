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
import { getCategoryLeafletIcon } from "@/components/map/categoryLeafletIcon";
import type { Location } from "@/db/schema";
import { getCategoryConfig } from "@/lib/category-config";

function MapFlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [center, map]);
  return null;
}

export function DayMapLeaflet({ locations }: { locations: Location[] }) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const center = useMemo<[number, number]>(() => {
    if (!locations.length) return [36.1699, -115.1398];
    return [Number(locations[0].lat), Number(locations[0].lng)];
  }, [locations]);

  const hikeLocations = useMemo(
    () => locations.filter((loc) => loc.type === "hike"),
    [locations]
  );

  const hikePositions = useMemo<[number, number][]>(
    () => hikeLocations.map((loc) => [Number(loc.lat), Number(loc.lng)]),
    [hikeLocations]
  );

  const flyToCenter = useMemo<[number, number] | null>(() => {
    if (!activeId) return null;
    const loc = locations.find((l) => l.id === activeId);
    if (!loc) return null;
    return [Number(loc.lat), Number(loc.lng)];
  }, [activeId, locations]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[2rem] border border-border/70">
        <MapContainer
          center={center}
          zoom={10}
          scrollWheelZoom
          className="h-52 w-full sm:h-[22rem]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFlyTo center={flyToCenter} />

          {hikePositions.length >= 2 ? (
            <Polyline
              positions={hikePositions}
              color="#22c55e"
              weight={3}
              dashArray="9 6"
              opacity={0.9}
            >
              <Popup minWidth={180} maxWidth={260}>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                  Hike Trail
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
          ) : null}

          {locations.map((location) => (
            <Marker
              key={location.id}
              icon={getCategoryLeafletIcon(location.type)}
              position={[Number(location.lat), Number(location.lng)]}
              eventHandlers={{ click: () => setActiveId(location.id) }}
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
          ))}
        </MapContainer>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {locations.map((location) => {
          const isActive = location.id === activeId;
          return (
            <button
              key={location.id}
              type="button"
              onClick={() => setActiveId(isActive ? null : location.id)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                isActive
                  ? "border-primary/40 bg-primary/8 ring-1 ring-primary/30"
                  : "border-border/60 bg-secondary/30 hover:border-border hover:bg-secondary/50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{location.name}</p>
                <Badge className="bg-secondary text-foreground capitalize">
                  {location.type}
                </Badge>
              </div>
              {location.tip ? (
                <p className="mt-2 text-sm text-muted-foreground">{location.tip}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
