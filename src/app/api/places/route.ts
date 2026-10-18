import { NextResponse } from "next/server";

import { requireRouteTripContext } from "@/lib/route-auth";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

/** Place autocomplete for adding stops. Proxies Photon (OpenStreetMap) so clients get one stable shape. */
export async function GET(request: Request) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const params = new URLSearchParams({ q: query, limit: "6", lang: "en" });
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    params.set("lat", String(lat));
    params.set("lon", String(lng));
  }

  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { "User-Agent": "Northstar Travel Guide (northstartravelguide.com)" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return NextResponse.json([]);
    }
    const data = (await response.json()) as { features?: PhotonFeature[] };
    const results = (data.features ?? []).map((feature, index) => {
      const p = feature.properties;
      const street = [p.housenumber, p.street].filter(Boolean).join(" ");
      const address = [street, p.city ?? p.county, p.state, p.country]
        .filter(Boolean)
        .filter((part, i, all) => all.indexOf(part) === i && part !== p.name)
        .join(", ");
      return {
        id: `${p.osm_type ?? "x"}${p.osm_id ?? index}`,
        name: p.name ?? street ?? query,
        address,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
      };
    });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
