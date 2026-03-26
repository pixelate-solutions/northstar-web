import L from "leaflet";

import { getCategoryConfig } from "@/lib/category-config";

const iconCache = new Map<string, L.DivIcon>();

function createMarkerSvg(color: string) {
  return `
    <svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M15 1.5C7.82 1.5 2 7.32 2 14.5C2 24.64 13.45 38.6 14.6 39.99C14.8 40.23 15.2 40.23 15.4 39.99C16.55 38.6 28 24.64 28 14.5C28 7.32 22.18 1.5 15 1.5Z"
        fill="${color}"
        stroke="rgba(255,255,255,0.96)"
        stroke-width="2"
      />
      <circle cx="15" cy="14.5" r="5.5" fill="white" fill-opacity="0.96" />
    </svg>
  `;
}

export function getCategoryLeafletIcon(category: string) {
  if (iconCache.has(category)) {
    return iconCache.get(category)!;
  }

  const icon = L.divIcon({
    className: "category-map-pin",
    html: createMarkerSvg(getCategoryConfig(category).color),
    iconSize: [30, 42],
    iconAnchor: [15, 40],
    popupAnchor: [0, -34],
  });

  iconCache.set(category, icon);
  return icon;
}
