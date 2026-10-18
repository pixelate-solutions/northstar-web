"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StarMark } from "@/components/brand/Logo";
import { Popover } from "@/components/ns/overlay";
import { useTrip } from "@/components/trip/TripProvider";
import { dateRange } from "@/lib/format";

const TILE_COLORS = ["#2F5D8A", "#0B6B4F", "#7A4E2D", "#5B3F8C", "#9A3B3B"];

export function TripTile({ id, name, active, size = 40 }: { id: number; name: string; active?: boolean; size?: number }) {
  if (active) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-[10px] bg-ink" style={{ width: size, height: size }}>
        <StarMark size={size * 0.45} color="#FFC500" core={null} />
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[10px] text-[15px] font-extrabold text-white"
      style={{ width: size, height: size, background: TILE_COLORS[id % TILE_COLORS.length] }}
    >
      {(name.trim()[0] ?? "T").toUpperCase()}
    </span>
  );
}

/** List of trips + "New trip". Shared by the desktop popover and the mobile sheet. */
export function TripList({ onDone }: { onDone: () => void }) {
  const { trips, bundle, switchTrip } = useTrip();
  const router = useRouter();
  return (
    <div className="flex flex-col">
      {trips.map((trip) => {
        const active = trip.id === bundle.trip.id;
        const sub = trip.role !== "owner" ? (trip.role === "viewer" ? "View only" : "Shared with you") : dateRange(trip.startDate, trip.endDate);
        return (
          <button
            key={trip.id}
            type="button"
            onClick={() => {
              onDone();
              if (!active) void switchTrip(trip.id);
            }}
            className={`flex items-center gap-3 rounded-[12px] p-2.5 text-left transition hover:bg-surface ${active ? "bg-surface" : ""}`}
          >
            <TripTile id={trip.id} name={trip.name} active={active} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`truncate text-[16px] text-ink ${active ? "font-bold" : "font-semibold"}`}>{trip.name}</span>
              {sub ? <span className="text-[13px] font-medium text-muted">{sub}</span> : null}
            </span>
            {active ? <Check size={18} strokeWidth={2.4} /> : null}
          </button>
        );
      })}
      <div className="mx-2.5 my-1.5 h-px bg-line" />
      <button
        type="button"
        onClick={() => {
          onDone();
          router.push("/new");
        }}
        className="flex items-center gap-3 rounded-[12px] p-2.5 text-left transition hover:bg-surface"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#B9B9B4]">
          <Plus size={16} strokeWidth={2.4} />
        </span>
        <span className="text-[16px] font-semibold">New trip</span>
      </button>
    </div>
  );
}

export function TripSwitcher() {
  const { bundle } = useTrip();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 rounded-[12px] bg-white px-2.5 py-2 text-left shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:shadow-float"
      >
        <TripTile id={bundle.trip.id} name={bundle.trip.name} active size={32} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold tracking-[-0.01em]">{bundle.trip.name}</span>
          <span className="text-[13px] font-medium text-muted">{dateRange(bundle.trip.startDate, bundle.trip.endDate)}</span>
        </span>
        <ChevronsUpDown size={16} className="text-muted" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="left-0 top-[62px] w-[380px] p-2">
        <TripList onDone={() => setOpen(false)} />
      </Popover>
    </div>
  );
}
