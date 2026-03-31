import { NextResponse } from "next/server";

interface WeatherResponse {
  high?: number;
  low?: number;
  summary?: string;
  disabled?: boolean;
  sourceDate?: string;
  requestedDate?: string;
  fallbackToLastYear?: boolean;
}

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function toUtcDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIsoDate() {
  return formatIsoDate(new Date());
}

function diffCalendarDays(start: string, end: string) {
  const startDate = toUtcDate(start);
  const endDate = toUtcDate(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

function sameCalendarDayLastYear(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  let nextDay = day;

  while (nextDay > 0) {
    const candidate = new Date(Date.UTC(year - 1, month - 1, nextDay));
    if (
      candidate.getUTCFullYear() === year - 1 &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === nextDay
    ) {
      return formatIsoDate(candidate);
    }
    nextDay -= 1;
  }

  return formatIsoDate(new Date(Date.UTC(year - 1, month - 1, 1)));
}

function summarizeWeatherCode(code?: number) {
  switch (code) {
    case 0:
      return "Clear";
    case 1:
    case 2:
      return "Partly cloudy";
    case 3:
      return "Cloudy";
    case 45:
    case 48:
      return "Fog";
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return "Drizzle";
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
      return "Rain";
    case 71:
    case 73:
    case 75:
    case 77:
      return "Snow";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
    case 96:
    case 99:
      return "Thunderstorm";
    default:
      return undefined;
  }
}

async function geocodeLocation(location: string) {
  const candidates = Array.from(
    new Set([
      location.trim(),
      location
        .split(",")
        .slice(0, 2)
        .join(",")
        .trim(),
      location.split(",")[0]?.trim() ?? "",
    ].filter(Boolean))
  );

  for (const candidate of candidates) {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        candidate
      )}&count=1&language=en&format=json`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as {
      results?: Array<{ latitude: number; longitude: number }>;
    };

    const match = data.results?.[0];
    if (match) {
      return match;
    }
  }

  throw new Error(`No geocoding result for "${location}".`);
}

async function loadDailyWeather(input: {
  latitude: number;
  longitude: number;
  date: string;
  mode: "forecast" | "archive";
}) {
  const baseUrl =
    input.mode === "forecast"
      ? "https://api.open-meteo.com/v1/forecast"
      : "https://archive-api.open-meteo.com/v1/archive";

  const response = await fetch(
    `${baseUrl}?latitude=${input.latitude}&longitude=${input.longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=16&start_date=${input.date}&end_date=${input.date}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Unable to load ${input.mode} weather.`);
  }

  const data = (await response.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      weather_code?: number[];
    };
  };

  const daily = data.daily;
  const day = daily?.time?.[0];
  const high = daily?.temperature_2m_max?.[0];
  const low = daily?.temperature_2m_min?.[0];
  const code = daily?.weather_code?.[0];

  if (!day || high === undefined || low === undefined) {
    throw new Error(`No ${input.mode} weather data available.`);
  }

  return {
    high,
    low,
    summary: summarizeWeatherCode(code),
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const location = params.get("location")?.trim() ?? "";
  const requestedDate = params.get("date");

  if (!location || !isIsoDate(requestedDate)) {
    return NextResponse.json({ disabled: true } satisfies WeatherResponse);
  }

  try {
    const geo = await geocodeLocation(location);
    const today = todayIsoDate();
    const dayDelta = diffCalendarDays(today, requestedDate);
    const useForecast = dayDelta >= 0 && dayDelta <= 16;
    const fallbackDate = sameCalendarDayLastYear(requestedDate);

    if (useForecast) {
      try {
        const forecast = await loadDailyWeather({
          latitude: geo.latitude,
          longitude: geo.longitude,
          date: requestedDate,
          mode: "forecast",
        });

        return NextResponse.json({
          ...forecast,
          requestedDate,
          sourceDate: requestedDate,
          fallbackToLastYear: false,
        } satisfies WeatherResponse);
      } catch {
        // Fall through to historical fallback.
      }
    }

    const historicalDate = dayDelta < 0 ? requestedDate : fallbackDate;
    const historical = await loadDailyWeather({
      latitude: geo.latitude,
      longitude: geo.longitude,
      date: historicalDate,
      mode: "archive",
    });

    return NextResponse.json({
      ...historical,
      requestedDate,
      sourceDate: historicalDate,
      fallbackToLastYear: dayDelta >= 0,
    } satisfies WeatherResponse);
  } catch {
    return NextResponse.json({ disabled: true } satisfies WeatherResponse);
  }
}
