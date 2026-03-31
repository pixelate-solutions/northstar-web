import { NextResponse } from "next/server";

interface WeatherResponse {
  high?: number;
  low?: number;
  summary?: string;
  disabled?: boolean;
  sourceDate?: string;
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
      location.split(",").slice(0, 2).join(",").trim(),
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

async function loadTodayWeather(latitude: number, longitude: number) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Unable to load forecast weather.");
  }

  const data = (await response.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      weather_code?: number[];
    };
  };

  const day = data.daily?.time?.[0];
  const high = data.daily?.temperature_2m_max?.[0];
  const low = data.daily?.temperature_2m_min?.[0];
  const code = data.daily?.weather_code?.[0];

  if (!day || high === undefined || low === undefined) {
    throw new Error("No forecast weather data available.");
  }

  return {
    high,
    low,
    summary: summarizeWeatherCode(code),
    sourceDate: day,
  };
}

export async function GET(request: Request) {
  const location = new URL(request.url).searchParams.get("location")?.trim() ?? "";
  if (!location) {
    return NextResponse.json({ disabled: true } satisfies WeatherResponse);
  }

  try {
    const geo = await geocodeLocation(location);
    const weather = await loadTodayWeather(geo.latitude, geo.longitude);
    return NextResponse.json(weather satisfies WeatherResponse);
  } catch {
    return NextResponse.json({ disabled: true } satisfies WeatherResponse);
  }
}
