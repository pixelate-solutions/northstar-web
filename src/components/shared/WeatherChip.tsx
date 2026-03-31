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
}

const ONE_HOUR = 60 * 60 * 1000;

function getCacheKey(location: string) {
  return `weather:${location}`;
}

function getCachedWeather(location: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.localStorage.getItem(getCacheKey(location));
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
}: {
  location: string;
}) {
  const [state, setState] = useState<{
    key: string;
    data: WeatherResponse | null;
    status: "loading" | "ready" | "error";
  }>(() => ({
    key: getCacheKey(location),
    data: getCachedWeather(location),
    status: getCachedWeather(location) ? "ready" : "loading",
  }));

  const cacheKey = useMemo(() => getCacheKey(location), [location]);
  const cachedWeather = getCachedWeather(location);
  const weather = state.key === cacheKey ? state.data ?? cachedWeather : cachedWeather;
  const status =
    weather
      ? "ready"
      : state.key === cacheKey && state.status === "error"
        ? "error"
        : "loading";

  useEffect(() => {
    if (cachedWeather) {
      return;
    }

    let ignore = false;

    fetch(`/api/weather?location=${encodeURIComponent(location)}`)
      .then((response) => response.json())
      .then((data: WeatherResponse) => {
        if (ignore) return;
        if (data.disabled) {
          setState({ key: cacheKey, data: null, status: "error" });
          return;
        }

        setState({ key: cacheKey, data, status: "ready" });
        window.localStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), data })
        );
      })
      .catch(() => {
        if (!ignore) {
          setState({ key: cacheKey, data: null, status: "error" });
        }
      });

    return () => {
      ignore = true;
    };
  }, [cacheKey, cachedWeather, location]);

  if (status !== "ready" || !weather || weather.disabled || weather.high === undefined || weather.low === undefined) {
    const fallbackLabel =
      status === "loading" ? "Loading weather..." : "Weather unavailable";
    const fallbackTooltip =
      status === "loading"
        ? "Loading today's weather"
        : "Today's weather is unavailable";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex">
                <Badge className="gap-1 border border-border/70 bg-secondary/70 px-3 py-1 text-xs text-foreground hover:cursor-help">
                  <CloudSun className="size-3.5 text-primary" />
                  {fallbackLabel}
                </Badge>
              </span>
            }
          />
          <TooltipContent side="bottom">{fallbackTooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const sourceDate = weather.sourceDate;
  const tooltipLabel = sourceDate
    ? `Showing weather for ${formatWeatherDateLabel(sourceDate)}`
    : "Showing today's weather";

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
