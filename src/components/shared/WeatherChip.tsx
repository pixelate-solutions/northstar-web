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

export function WeatherChip({ location }: { location: string }) {
  const [state, setState] = useState<WeatherResponse | null>(null);

  useEffect(() => {
    const cacheKey = `weather:${location}`;
    const cached = window.localStorage.getItem(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached) as { timestamp: number; data: WeatherResponse };
      if (Date.now() - parsed.timestamp < ONE_HOUR) {
        setState(parsed.data);
        return;
      }
    }

    let ignore = false;

    fetch(`/api/weather?location=${encodeURIComponent(location)}`)
      .then((response) => response.json())
      .then((data: WeatherResponse) => {
        if (ignore || data.disabled) return;
        setState(data);
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

  if (!state || state.disabled || state.high === undefined || state.low === undefined) {
    return null;
  }

  return (
    <Badge className="gap-1 border border-border/70 bg-secondary/70 px-3 py-1 text-xs text-foreground">
      <CloudSun className="size-3.5 text-primary" />
      {Math.round(state.high)}° / {Math.round(state.low)}°
      {state.summary ? <span className="text-muted-foreground">{state.summary}</span> : null}
    </Badge>
  );
}
