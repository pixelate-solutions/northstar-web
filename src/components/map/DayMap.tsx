"use client";

import dynamic from "next/dynamic";

import { EmptyState } from "@/components/shared/EmptyState";
import type { Location } from "@/db/schema";

const DayMapLeaflet = dynamic(
  () => import("./DayMapLeaflet").then((mod) => mod.DayMapLeaflet),
  { ssr: false }
);

export function DayMap({ locations }: { locations: Location[] }) {
  if (!locations.length) {
    return (
      <EmptyState
        title="No map pins yet"
        description="Seed the database or add locations to see the day map."
      />
    );
  }

  return <DayMapLeaflet locations={locations} />;
}
