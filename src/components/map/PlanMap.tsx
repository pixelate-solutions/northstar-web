"use client";

import dynamic from "next/dynamic";

import type { MapProps } from "./PlanMapLeaflet";

const PlanMapLeaflet = dynamic(() => import("./PlanMapLeaflet"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-land" />,
});

export type { MapPin } from "./PlanMapLeaflet";

export function PlanMap(props: MapProps & { mapsUrl?: string | null; className?: string }) {
  const { mapsUrl, className = "", ...mapProps } = props;
  return (
    <div className={`relative h-full w-full overflow-hidden bg-land ${className}`}>
      <PlanMapLeaflet {...mapProps} />
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-6 right-5 z-[400] flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold shadow-float transition hover:bg-surface"
        >
          Open in Maps
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M8 7h9v9" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}

export function googleMapsDirectionsUrl(points: Array<{ lat: number; lng: number }>) {
  if (!points.length) return null;
  if (points.length === 1) return `https://www.google.com/maps/search/?api=1&query=${points[0].lat},${points[0].lng}`;
  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1).slice(0, 9).map((point) => `${point.lat},${point.lng}`).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

