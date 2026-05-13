import type { DaySummary } from "@/lib/types";
import { travelImageFor } from "@/lib/travel-images";

export type RecommendationCategory =
  | "attractions"
  | "food"
  | "hikes"
  | "photo"
  | "shopping"
  | "stays";

export interface PlaceRecommendation {
  id: string;
  destination: string;
  title: string;
  category: RecommendationCategory;
  eventCategory: string;
  description: string;
  tip: string;
  lat: string;
  lng: string;
  cost: number;
  durationMinutes: number;
  imageUrl: string;
  sourceLabel: string;
}

export interface RecommendationCollection {
  destination: string;
  summary: string;
  recommendations: PlaceRecommendation[];
}

export const EXPLORE_CATEGORIES: Array<{
  id: RecommendationCategory;
  label: string;
  icon: string;
}> = [
  { id: "attractions", label: "Attractions", icon: "MapPin" },
  { id: "food", label: "Restaurants", icon: "UtensilsCrossed" },
  { id: "hikes", label: "Hikes", icon: "Mountain" },
  { id: "photo", label: "Photo spots", icon: "Camera" },
  { id: "shopping", label: "Shopping", icon: "ShoppingBag" },
  { id: "stays", label: "Places to stay", icon: "BedDouble" },
];

function imageFor(query: string) {
  return travelImageFor(query);
}

const RECOMMENDATION_CATALOG: Record<string, RecommendationCollection> = {
  paris: {
    destination: "Paris",
    summary:
      "A focused set of classic sights, scenic neighborhoods, and easy food stops for building a first pass Paris itinerary.",
    recommendations: [
      {
        id: "paris-eiffel-tower",
        destination: "Paris",
        title: "Eiffel Tower",
        category: "attractions",
        eventCategory: "sightseeing",
        description:
          "Iconic Paris landmark with observation decks, river views, and easy connections to Champ de Mars.",
        tip: "Book timed tickets ahead and keep a nearby sunset slot open.",
        lat: "48.8583701",
        lng: "2.2944813",
        cost: 35,
        durationMinutes: 90,
        imageUrl: imageFor("Eiffel Tower Paris"),
        sourceLabel: "Common Paris highlight",
      },
      {
        id: "paris-louvre",
        destination: "Paris",
        title: "Louvre Museum",
        category: "attractions",
        eventCategory: "sightseeing",
        description:
          "Major art museum in a former palace, best handled with a short hit list instead of trying to see everything.",
        tip: "Reserve a morning entry and choose two wings before arrival.",
        lat: "48.8606111",
        lng: "2.337644",
        cost: 25,
        durationMinutes: 150,
        imageUrl: imageFor("Louvre Paris"),
        sourceLabel: "Museum favorite",
      },
      {
        id: "paris-musee-orsay",
        destination: "Paris",
        title: "Musee d'Orsay",
        category: "attractions",
        eventCategory: "sightseeing",
        description:
          "19th and 20th century art museum in a former railway station with a memorable clock view.",
        tip: "Pair it with a Seine walk or Tuileries stop.",
        lat: "48.8599614",
        lng: "2.3265614",
        cost: 18,
        durationMinutes: 120,
        imageUrl: imageFor("Musee d'Orsay Paris clock"),
        sourceLabel: "Art and architecture",
      },
      {
        id: "paris-montmartre",
        destination: "Paris",
        title: "Montmartre and Sacre-Coeur",
        category: "photo",
        eventCategory: "sightseeing",
        description:
          "Hilltop basilica, village-like streets, and wide city views north of central Paris.",
        tip: "Go early or near sunset, then wander downhill for cafes.",
        lat: "48.8867046",
        lng: "2.3431043",
        cost: 0,
        durationMinutes: 90,
        imageUrl: imageFor("Montmartre Sacre Coeur Paris"),
        sourceLabel: "Scenic neighborhood",
      },
      {
        id: "paris-le-marais",
        destination: "Paris",
        title: "Le Marais food walk",
        category: "food",
        eventCategory: "food",
        description:
          "Compact neighborhood for bakeries, falafel, wine bars, boutiques, and an easy unscheduled meal.",
        tip: "Keep this flexible and use it as a low-friction lunch or dinner block.",
        lat: "48.8574753",
        lng: "2.358311",
        cost: 35,
        durationMinutes: 90,
        imageUrl: imageFor("Paris cafe food Le Marais"),
        sourceLabel: "Food area",
      },
      {
        id: "paris-luxembourg-gardens",
        destination: "Paris",
        title: "Luxembourg Gardens",
        category: "photo",
        eventCategory: "sightseeing",
        description:
          "Classic garden break with fountains, lawns, chairs, and an easy route into Saint-Germain.",
        tip: "Useful as a reset between museums or a slow morning.",
        lat: "48.846221",
        lng: "2.337160",
        cost: 0,
        durationMinutes: 60,
        imageUrl: imageFor("Luxembourg Gardens Paris"),
        sourceLabel: "Low-key break",
      },
    ],
  },
  sedona: {
    destination: "Sedona",
    summary:
      "Red rock hikes, scenic overlooks, and low-effort food stops that fit well into a flexible Arizona day.",
    recommendations: [
      {
        id: "sedona-cathedral-rock",
        destination: "Sedona",
        title: "Cathedral Rock Trail",
        category: "hikes",
        eventCategory: "hike",
        description:
          "Short, steep red-rock hike with one of Sedona's most recognizable views.",
        tip: "Start early and check shuttle or parking rules before leaving.",
        lat: "34.8222000",
        lng: "-111.7901000",
        cost: 0,
        durationMinutes: 90,
        imageUrl: imageFor("Cathedral Rock Sedona"),
        sourceLabel: "Signature hike",
      },
      {
        id: "sedona-airport-mesa",
        destination: "Sedona",
        title: "Airport Mesa sunset",
        category: "photo",
        eventCategory: "sightseeing",
        description:
          "Easy overlook and loop option with broad sunset views over Sedona's red rocks.",
        tip: "Arrive before golden hour; parking gets tight.",
        lat: "34.8547000",
        lng: "-111.7889000",
        cost: 0,
        durationMinutes: 75,
        imageUrl: imageFor("Airport Mesa Sedona sunset"),
        sourceLabel: "Sunset view",
      },
      {
        id: "sedona-tlaquepaque",
        destination: "Sedona",
        title: "Tlaquepaque Arts and Shopping Village",
        category: "shopping",
        eventCategory: "shopping",
        description:
          "Walkable arts village with shops, galleries, cafes, and shaded courtyards.",
        tip: "Good midday stop when trails are crowded or hot.",
        lat: "34.8640000",
        lng: "-111.7637000",
        cost: 0,
        durationMinutes: 75,
        imageUrl: imageFor("Tlaquepaque Sedona"),
        sourceLabel: "Easy stroll",
      },
      {
        id: "sedona-devils-bridge",
        destination: "Sedona",
        title: "Devil's Bridge Trail",
        category: "hikes",
        eventCategory: "hike",
        description:
          "Popular hike to a natural sandstone arch with classic Sedona photos.",
        tip: "Use the official trailhead plan and avoid peak midday crowds.",
        lat: "34.9028000",
        lng: "-111.8134000",
        cost: 0,
        durationMinutes: 150,
        imageUrl: imageFor("Devils Bridge Sedona"),
        sourceLabel: "Photo hike",
      },
    ],
  },
  "grand-canyon": {
    destination: "Grand Canyon",
    summary:
      "South Rim viewpoints and efficient rim-walk stops that fit into a road-trip day.",
    recommendations: [
      {
        id: "grand-canyon-mather-point",
        destination: "Grand Canyon",
        title: "Mather Point",
        category: "attractions",
        eventCategory: "sightseeing",
        description:
          "Accessible South Rim viewpoint near the visitor center with huge canyon views.",
        tip: "Great first stop if you have limited time at the South Rim.",
        lat: "36.0605000",
        lng: "-112.1074000",
        cost: 0,
        durationMinutes: 45,
        imageUrl: imageFor("Grand Canyon Mather Point"),
        sourceLabel: "South Rim classic",
      },
      {
        id: "grand-canyon-rim-trail",
        destination: "Grand Canyon",
        title: "Rim Trail walk",
        category: "hikes",
        eventCategory: "hike",
        description:
          "Flexible paved and dirt path along the rim with shuttle access and many turnaround points.",
        tip: "Pick a short segment rather than overloading a drive day.",
        lat: "36.0574000",
        lng: "-112.1431000",
        cost: 0,
        durationMinutes: 90,
        imageUrl: imageFor("Grand Canyon Rim Trail"),
        sourceLabel: "Flexible walk",
      },
    ],
  },
  page: {
    destination: "Page",
    summary:
      "Page, Arizona staples that combine well with Grand Canyon or Zion transfer days.",
    recommendations: [
      {
        id: "page-antelope-canyon",
        destination: "Page",
        title: "Antelope Canyon tour",
        category: "attractions",
        eventCategory: "sightseeing",
        description:
          "Guided slot canyon tour known for sculpted sandstone and light beams.",
        tip: "Reserve far ahead and confirm exact meeting location.",
        lat: "36.8619000",
        lng: "-111.3743000",
        cost: 85,
        durationMinutes: 90,
        imageUrl: imageFor("Antelope Canyon Page Arizona"),
        sourceLabel: "Book-ahead tour",
      },
      {
        id: "page-horseshoe-bend",
        destination: "Page",
        title: "Horseshoe Bend",
        category: "photo",
        eventCategory: "sightseeing",
        description:
          "Short walk to a dramatic Colorado River overlook just outside Page.",
        tip: "Sunset is popular; bring water and expect paid parking.",
        lat: "36.8791000",
        lng: "-111.5104000",
        cost: 10,
        durationMinutes: 60,
        imageUrl: imageFor("Horseshoe Bend Page Arizona"),
        sourceLabel: "Sunset overlook",
      },
    ],
  },
  zion: {
    destination: "Zion",
    summary:
      "Zion stops that work well for a shuttle-based park day from Springdale.",
    recommendations: [
      {
        id: "zion-scout-lookout",
        destination: "Zion",
        title: "Scout Lookout via West Rim Trail",
        category: "hikes",
        eventCategory: "hike",
        description:
          "Strenuous climb with big canyon views before the permit-only Angels Landing section.",
        tip: "Start early, use the shuttle, and carry more water than you think.",
        lat: "37.2750000",
        lng: "-112.9510000",
        cost: 0,
        durationMinutes: 210,
        imageUrl: imageFor("Zion Scout Lookout"),
        sourceLabel: "Major hike",
      },
      {
        id: "zion-canyon-overlook",
        destination: "Zion",
        title: "Canyon Overlook Trail",
        category: "hikes",
        eventCategory: "hike",
        description:
          "Shorter trail near the tunnel with a big payoff view over Zion Canyon.",
        tip: "Parking is limited; treat it as a compact scenic stop.",
        lat: "37.2132000",
        lng: "-112.9405000",
        cost: 0,
        durationMinutes: 75,
        imageUrl: imageFor("Zion Canyon Overlook Trail"),
        sourceLabel: "Short hike",
      },
      {
        id: "zion-springdale-dinner",
        destination: "Zion",
        title: "Springdale dinner",
        category: "food",
        eventCategory: "food",
        description:
          "Use Springdale for an easy post-park dinner without moving the car again.",
        tip: "Whiptail Grill and Zion Canyon Brew Pub are common easy options.",
        lat: "37.1889000",
        lng: "-112.9986000",
        cost: 40,
        durationMinutes: 90,
        imageUrl: imageFor("Springdale Utah restaurant Zion"),
        sourceLabel: "After-park meal",
      },
    ],
  },
  bryce: {
    destination: "Bryce Canyon",
    summary:
      "Hoodoo viewpoints, rim walks, and classic Bryce Canyon hiking building blocks.",
    recommendations: [
      {
        id: "bryce-navajo-queens-garden",
        destination: "Bryce Canyon",
        title: "Navajo Loop and Queen's Garden",
        category: "hikes",
        eventCategory: "hike",
        description:
          "Classic Bryce hike through hoodoos, switchbacks, and canyon amphitheater views.",
        tip: "Start at Sunrise Point and check seasonal trail closures.",
        lat: "37.6233000",
        lng: "-112.1677000",
        cost: 0,
        durationMinutes: 180,
        imageUrl: imageFor("Bryce Canyon Navajo Loop"),
        sourceLabel: "Classic hike",
      },
      {
        id: "bryce-sunset-point",
        destination: "Bryce Canyon",
        title: "Sunset Point",
        category: "photo",
        eventCategory: "sightseeing",
        description:
          "Easy overlook with dense hoodoo views and quick access to the rim trail.",
        tip: "Good for a low-effort golden-hour stop.",
        lat: "37.6238000",
        lng: "-112.1689000",
        cost: 0,
        durationMinutes: 45,
        imageUrl: imageFor("Bryce Canyon Sunset Point"),
        sourceLabel: "Viewpoint",
      },
    ],
  },
  "las-vegas": {
    destination: "Las Vegas",
    summary:
      "Easy Strip stops, food breaks, and nearby landmarks that fit into a short Las Vegas pass-through.",
    recommendations: [
      {
        id: "las-vegas-bellagio-fountains",
        destination: "Las Vegas",
        title: "Bellagio Fountains",
        category: "attractions",
        eventCategory: "sightseeing",
        description:
          "Free choreographed fountain show on the Strip with frequent evening performances.",
        tip: "Time it as a short stop before or after dinner.",
        lat: "36.1126000",
        lng: "-115.1767000",
        cost: 0,
        durationMinutes: 30,
        imageUrl: imageFor("Bellagio Fountains Las Vegas"),
        sourceLabel: "Free show",
      },
      {
        id: "las-vegas-forum-shops",
        destination: "Las Vegas",
        title: "Forum Shops and Strip walk",
        category: "shopping",
        eventCategory: "shopping",
        description:
          "Indoor shopping and people-watching route that works in hot weather or between reservations.",
        tip: "Use it as flexible filler instead of a fixed anchor.",
        lat: "36.1182000",
        lng: "-115.1762000",
        cost: 0,
        durationMinutes: 90,
        imageUrl: imageFor("Las Vegas Strip shopping"),
        sourceLabel: "Flexible stop",
      },
      {
        id: "las-vegas-hoover-dam",
        destination: "Las Vegas",
        title: "Hoover Dam",
        category: "attractions",
        eventCategory: "sightseeing",
        description:
          "Major engineering landmark outside Las Vegas that pairs well with an Arizona drive.",
        tip: "Check security and tour timing before making it a fixed stop.",
        lat: "36.0161000",
        lng: "-114.7377000",
        cost: 15,
        durationMinutes: 90,
        imageUrl: imageFor("Hoover Dam Nevada"),
        sourceLabel: "Road-trip landmark",
      },
    ],
  },
  generic: {
    destination: "Your Destination",
    summary:
      "A starter set of common trip-building blocks. Add them to a day, then tune times and details.",
    recommendations: [
      {
        id: "generic-viewpoint",
        destination: "Your Destination",
        title: "Scenic viewpoint",
        category: "photo",
        eventCategory: "sightseeing",
        description:
          "A flexible scenic stop to anchor the day and add a visual moment to the plan.",
        tip: "Replace this with a named viewpoint once your destination is set.",
        lat: "36.1699000",
        lng: "-115.1398000",
        cost: 0,
        durationMinutes: 45,
        imageUrl: imageFor("scenic viewpoint travel"),
        sourceLabel: "Planning placeholder",
      },
      {
        id: "generic-local-meal",
        destination: "Your Destination",
        title: "Local meal stop",
        category: "food",
        eventCategory: "food",
        description:
          "A meal block with enough time to account for waiting, ordering, and travel between stops.",
        tip: "Swap in a specific restaurant after checking hours.",
        lat: "36.1699000",
        lng: "-115.1398000",
        cost: 35,
        durationMinutes: 75,
        imageUrl: imageFor("local restaurant travel"),
        sourceLabel: "Planning placeholder",
      },
    ],
  },
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inferCollectionKey(value: string | null | undefined) {
  const text = value?.toLowerCase() ?? "";

  if (text.includes("paris")) return "paris";
  if (text.includes("las vegas") || text.includes("vegas")) return "las-vegas";
  if (text.includes("sedona")) return "sedona";
  if (text.includes("grand canyon")) return "grand-canyon";
  if (text.includes("page") || text.includes("antelope") || text.includes("horseshoe")) {
    return "page";
  }
  if (text.includes("zion") || text.includes("springdale")) return "zion";
  if (text.includes("bryce")) return "bryce";

  return null;
}

export function getRecommendationCollectionForText(
  value: string | null | undefined
): RecommendationCollection {
  const key = inferCollectionKey(value) ?? "generic";
  return RECOMMENDATION_CATALOG[key] ?? RECOMMENDATION_CATALOG.generic;
}

export function getRecommendationsForDay(day: Pick<DaySummary, "title" | "location">) {
  return getRecommendationCollectionForText(`${day.title} ${day.location}`);
}

export function getRecommendationsForTrip(days: Array<Pick<DaySummary, "title" | "location">>) {
  const seen = new Set<string>();
  const collections = days
    .map((day) => getRecommendationsForDay(day))
    .filter((collection) => {
      const key = slugify(collection.destination);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return collections.length ? collections : [RECOMMENDATION_CATALOG.generic];
}

export function getAllRecommendationsForTrip(
  days: Array<Pick<DaySummary, "title" | "location">>
) {
  const seen = new Set<string>();
  return getRecommendationsForTrip(days)
    .flatMap((collection) => collection.recommendations)
    .filter((recommendation) => {
      if (seen.has(recommendation.id)) return false;
      seen.add(recommendation.id);
      return true;
    });
}

export function findRecommendationById(id: string) {
  for (const collection of Object.values(RECOMMENDATION_CATALOG)) {
    const recommendation = collection.recommendations.find((item) => item.id === id);
    if (recommendation) return recommendation;
  }

  return null;
}

export function getSuggestedStartTime(index: number) {
  const schedule = ["09:00", "10:30", "12:30", "14:00", "16:00", "18:00"];
  return schedule[index % schedule.length] ?? "09:00";
}

export function addMinutesToTime(time: string, minutes: number) {
  const [hoursText, minutesText] = time.split(":");
  const startMinutes =
    Number.parseInt(hoursText ?? "9", 10) * 60 +
    Number.parseInt(minutesText ?? "0", 10);
  const nextMinutes = Math.min(startMinutes + minutes, 23 * 60 + 59);
  const hours = Math.floor(nextMinutes / 60);
  const mins = nextMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
