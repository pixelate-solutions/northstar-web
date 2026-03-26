import Link from "next/link";
import { Navigation } from "lucide-react";

import type { Location } from "@/db/schema";

export function LocationPopup({ location }: { location: Location }) {
  return (
    <div className="min-w-44 space-y-2 text-sm">
      <div>
        <p className="font-semibold text-slate-900">{location.name}</p>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
          {location.type}
        </p>
      </div>
      {location.description ? (
        <p className="text-slate-700">{location.description}</p>
      ) : null}
      {location.tip ? <p className="text-slate-600">{location.tip}</p> : null}
      {location.googleMapsUrl ? (
        <Link
          href={location.googleMapsUrl}
          target="_blank"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600"
        >
          <Navigation className="size-4" />
          Get Directions
        </Link>
      ) : null}
    </div>
  );
}
