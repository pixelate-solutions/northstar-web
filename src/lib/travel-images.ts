const IMAGE_PARAMS = "?w=900&h=640&fit=crop&auto=format";

const TRAVEL_IMAGES = {
  paris: `https://images.unsplash.com/photo-1502602898657-3e91760cbb34${IMAGE_PARAMS}`,
  parisStreet: `https://images.unsplash.com/photo-1511739001486-6bfe10ce785f${IMAGE_PARAMS}`,
  restaurant: `https://images.unsplash.com/photo-1414235077428-338989a2e8c0${IMAGE_PARAMS}`,
  sedona: `https://images.unsplash.com/photo-1518837695005-2083093ee35b${IMAGE_PARAMS}`,
  grandCanyon: `https://images.unsplash.com/photo-1615551043360-33de8b5f410c${IMAGE_PARAMS}`,
  nationalPark: `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800${IMAGE_PARAMS}`,
  desertRoad: `https://images.unsplash.com/photo-1509316785289-025f5b846b35${IMAGE_PARAMS}`,
  lasVegas: `https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d${IMAGE_PARAMS}`,
  scenic: `https://images.unsplash.com/photo-1500530855697-b586d89ba3ee${IMAGE_PARAMS}`,
};

function normalizeImageKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function travelImageFor(value: string | null | undefined) {
  const key = normalizeImageKey(value ?? "");

  if (
    key.includes("eiffel") ||
    key.includes("louvre") ||
    key.includes("orsay") ||
    key.includes("montmartre") ||
    key.includes("sacre") ||
    key.includes("luxembourg") ||
    key.includes("paris")
  ) {
    if (key.includes("cafe") || key.includes("food") || key.includes("restaurant")) {
      return TRAVEL_IMAGES.restaurant;
    }
    if (key.includes("street") || key.includes("marais") || key.includes("montmartre")) {
      return TRAVEL_IMAGES.parisStreet;
    }
    return TRAVEL_IMAGES.paris;
  }

  if (
    key.includes("sedona") ||
    key.includes("cathedral") ||
    key.includes("airport mesa") ||
    key.includes("tlaquepaque") ||
    key.includes("devil")
  ) {
    return TRAVEL_IMAGES.sedona;
  }

  if (key.includes("grand canyon") || key.includes("mather") || key.includes("rim trail")) {
    return TRAVEL_IMAGES.grandCanyon;
  }

  if (key.includes("antelope") || key.includes("horseshoe") || key.includes("page arizona")) {
    return TRAVEL_IMAGES.desertRoad;
  }

  if (key.includes("zion") || key.includes("springdale") || key.includes("bryce")) {
    return TRAVEL_IMAGES.nationalPark;
  }

  if (key.includes("las vegas") || key.includes("bellagio") || key.includes("strip")) {
    return TRAVEL_IMAGES.lasVegas;
  }

  if (key.includes("hoover")) {
    return TRAVEL_IMAGES.desertRoad;
  }

  if (key.includes("restaurant") || key.includes("meal") || key.includes("food")) {
    return TRAVEL_IMAGES.restaurant;
  }

  return TRAVEL_IMAGES.scenic;
}

export function resolveTravelImageUrl(
  src: string | null | undefined,
  fallbackKey?: string | null
) {
  const trimmed = src?.trim();

  if (!trimmed || trimmed.includes("source.unsplash.com")) {
    return travelImageFor(`${fallbackKey ?? ""} ${trimmed ?? ""}`);
  }

  return trimmed;
}
