import "server-only";

function haversineDistanceKm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(origin.lat)) *
      Math.cos(toRadians(destination.lat)) *
      Math.sin(lngDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function geocodePlace(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("A location query is required.");
  }

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      trimmed
    )}&count=1&language=en&format=json`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Unable to geocode "${trimmed}".`);
  }

  const json = (await response.json()) as {
    results?: Array<{
      name: string;
      country?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  };

  const match = json.results?.[0];
  if (!match) {
    throw new Error(`No location match found for "${trimmed}".`);
  }

  return {
    label: [match.name, match.admin1, match.country].filter(Boolean).join(", "),
    lat: match.latitude,
    lng: match.longitude,
    timeZone: match.timezone ?? "UTC",
  };
}

export async function estimateRoute(originQuery: string, destinationQuery: string) {
  const [origin, destination] = await Promise.all([
    geocodePlace(originQuery),
    geocodePlace(destinationQuery),
  ]);

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`,
      { cache: "no-store" }
    );

    if (response.ok) {
      const json = (await response.json()) as {
        routes?: Array<{ duration: number; distance: number }>;
      };
      const route = json.routes?.[0];
      if (route) {
        return {
          origin,
          destination,
          distanceKm: Number((route.distance / 1000).toFixed(1)),
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
        };
      }
    }
  } catch {
    // Fall back to a rough estimate.
  }

  const fallbackDistance = haversineDistanceKm(origin, destination);
  const durationMinutes = Math.max(30, Math.round((fallbackDistance / 72) * 60));

  return {
    origin,
    destination,
    distanceKm: Number(fallbackDistance.toFixed(1)),
    durationMinutes,
  };
}
