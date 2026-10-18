"use client";

import { useEffect, useState } from "react";

const cache = new Map<string, number | null>();

/** Forecast high (°F) for a place, when OpenWeather is configured. */
export function useWeatherHigh(location: string | null | undefined) {
  const key = location?.trim() ?? "";
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!key || cache.has(key)) return;
    let cancelled = false;
    fetch(`/api/weather?location=${encodeURIComponent(key)}`)
      .then((response) => response.json())
      .then((data: { high?: number }) => {
        cache.set(key, typeof data.high === "number" ? Math.round(data.high) : null);
        if (!cancelled) setVersion((v) => v + 1);
      })
      .catch(() => cache.set(key, null));
    return () => {
      cancelled = true;
    };
  }, [key]);
  return key ? cache.get(key) ?? null : null;
}
