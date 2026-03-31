"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudSun } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeatherResponse {
  high?: number;
  low?: number;
  summary?: string;
  disabled?: boolean;
  sourceDate?: string;
  requestedDate?: string;
  fallbackToLastYear?: boolean;
}

const ONE_HOUR = 60 * 60 * 1000;

function getCacheKey(location: string, date: string) {
  return `weather:${location}:${date}`;
}

function getCachedWeather(location: string, date: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.localStorage.getItem(getCacheKey(location, date));
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

function formatWeatherDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function WeatherChip({
  location,
  date,
}: {
  location: string;
  date: string;
}) {
  const [state, setState] = useState<{
    key: string;
    data: WeatherResponse | null;
  }>(() => ({
    key: getCacheKey(location, date),
    data: getCachedWeather(location, date),
  }));

  const cacheKey = useMemo(() => getCacheKey(location, date), [location, date]);
  const cachedWeather = getCachedWeather(location, date);
  const weather = state.key === cacheKey ? state.data ?? cachedWeather : cachedWeather;

  useEffect(() => {
    if (cachedWeather) {
      return;
    }

    let ignore = false;

    fetch(`/api/weather?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`)
      .then((response) => response.json())
      .then((data: WeatherResponse) => {
        if (ignore || data.disabled) return;
        setState({ key: cacheKey, data });
        window.localStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), data })
        );
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [cacheKey, cachedWeather, date, location]);

  if (!weather || weather.disabled || weather.high === undefined || weather.low === undefined) {
    return null;
  }

  const sourceDate = weather.sourceDate ?? date;
  const tooltipLabel = weather.fallbackToLastYear
    ? `Showing weather for ${formatWeatherDateLabel(sourceDate)} (last year)`
    : `Showing weather for ${formatWeatherDateLabel(sourceDate)}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex">
              <Badge className="gap-1 border border-border/70 bg-secondary/70 px-3 py-1 text-xs text-foreground hover:cursor-help">
                <CloudSun className="size-3.5 text-primary" />
                {Math.round(weather.high)}° / {Math.round(weather.low)}°
                {weather.summary ? (
                  <span className="text-muted-foreground">{weather.summary}</span>
                ) : null}
              </Badge>
            </span>
          }
        />
        <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
