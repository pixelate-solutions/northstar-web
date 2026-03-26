"use client";

import { useEffect, useState } from "react";
import { CloudSun } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface WeatherResponse {
  high?: number;
  low?: number;
  summary?: string;
  disabled?: boolean;
}

const ONE_HOUR = 60 * 60 * 1000;

function getCachedWeather(location: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const cacheKey = `weather:${location}`;
  const cached = window.localStorage.getItem(cacheKey);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached) as { timestamp: number; data: WeatherResponse };
    return Date.now() - parsed.timestamp < ONE_HOUR ? parsed.data : null;
  } catch {
    return null;
  }
}

export function WeatherChip({ location }: { location: string }) {
  const [state, setState] = useState<{ location: string; data: WeatherResponse | null }>(() => ({
    location,
    data: getCachedWeather(location),
  }));
  const weather = state.location === location ? state.data : getCachedWeather(location);

  useEffect(() => {
    const cacheKey = `weather:${location}`;
    if (getCachedWeather(location)) {
      return;
    }

    let ignore = false;

    fetch(`/api/weather?location=${encodeURIComponent(location)}`)
      .then((response) => response.json())
      .then((data: WeatherResponse) => {
        if (ignore || data.disabled) return;
        setState({ location, data });
        window.localStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), data })
        );
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [location]);

  if (!weather || weather.disabled || weather.high === undefined || weather.low === undefined) {
    return null;
  }

  return (
    <Badge className="gap-1 border border-border/70 bg-secondary/70 px-3 py-1 text-xs text-foreground">
      <CloudSun className="size-3.5 text-primary" />
      {Math.round(weather.high)}° / {Math.round(weather.low)}°
      {weather.summary ? <span className="text-muted-foreground">{weather.summary}</span> : null}
    </Badge>
  );
}
