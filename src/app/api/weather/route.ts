import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  const location = new URL(request.url).searchParams.get("location");

  if (!apiKey || !location) {
    return NextResponse.json({ disabled: true });
  }

  try {
    const geoResponse = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        location
      )}&limit=1&appid=${apiKey}`,
      { cache: "no-store" }
    );
    const [geo] = (await geoResponse.json()) as Array<{ lat: number; lon: number }>;

    if (!geo) {
      return NextResponse.json({ disabled: true });
    }

    const weatherResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${geo.lat}&lon=${geo.lon}&units=imperial&appid=${apiKey}`,
      { cache: "no-store" }
    );
    const data = (await weatherResponse.json()) as {
      list?: Array<{ main: { temp_max: number; temp_min: number }; weather: Array<{ main: string }> }>;
    };

    const first = data.list?.[0];
    if (!first) return NextResponse.json({ disabled: true });

    return NextResponse.json({
      high: first.main.temp_max,
      low: first.main.temp_min,
      summary: first.weather[0]?.main,
    });
  } catch {
    return NextResponse.json({ disabled: true });
  }
}
