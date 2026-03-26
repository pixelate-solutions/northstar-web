"use client";

import dynamic from "next/dynamic";

import type { DaySummary } from "@/lib/types";

const TripMapLeaflet = dynamic(
  () => import("./TripMapLeaflet").then((mod) => mod.TripMapLeaflet),
  { ssr: false }
);

export function TripMap({ days }: { days: DaySummary[] }) {
  return <TripMapLeaflet days={days} />;
}
