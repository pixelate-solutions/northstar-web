"use client";

import { useEffect, useState } from "react";

export type LatLng = [number, number];

export interface RouteResult {
  coordinates: LatLng[];
  legs: Array<{ duration: number; distance: number }>;
  duration: number;
  distance: number;
}

const cache = new Map<string, RouteResult | null>();

/** Driving route through points in order (OSRM). Returns null while loading or if routing fails. */
export function useRoute(points: LatLng[]) {
  const key = points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";");
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (points.length < 2 || points.length > 90 || cache.has(key)) return;
    const controller = new AbortController();
    const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
    fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { routes?: Array<{ duration: number; distance: number; legs: Array<{ duration: number; distance: number }>; geometry: { coordinates: [number, number][] } }> } | null) => {
        const route = data?.routes?.[0];
        const value: RouteResult | null = route
          ? {
              coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
              legs: route.legs.map((leg) => ({ duration: leg.duration, distance: leg.distance })),
              duration: route.duration,
              distance: route.distance,
            }
          : null;
        cache.set(key, value);
        setVersion((v) => v + 1);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          cache.set(key, null);
          setVersion((v) => v + 1);
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (points.length < 2) return null;
  return cache.get(key) ?? null;
}
