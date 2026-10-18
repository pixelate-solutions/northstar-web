"use client";

import { CalendarDays, Download, MoreHorizontal, NotebookPen, Pencil, Share, Trash2 } from "lucide-react";
import { useState } from "react";

import { IconButton, MenuItem, Popover } from "@/components/ns/overlay";
import { DatesDialog, DeleteTripDialog, EditDayDialog, RenameDialog, ShareDialog } from "@/components/plan/TripDialogs";
import { useTrip } from "@/components/trip/TripProvider";
import type { DayJson } from "@/lib/client-types";

type DialogName = "day" | "dates" | "rename" | "delete" | "share" | null;

export function exportTrip() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  window.location.href = `/api/trips/export?tz=${encodeURIComponent(tz)}`;
}

/** Share button + "…" menu used in the Plan header. */
export function PlanActions({ day }: { day?: DayJson | null }) {
  const { isOwner, canEdit } = useTrip();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogName>(null);
  const open = (name: DialogName) => {
    setMenuOpen(false);
    setDialog(name);
  };

  return (
    <div className="flex items-center gap-1.5">
      {isOwner ? (
        <button
          type="button"
          onClick={() => setDialog("share")}
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-[7px] text-[14px] font-semibold transition hover:bg-surface"
        >
          <Share size={15} strokeWidth={2} /> Share
        </button>
      ) : null}
      <div className="relative">
        <IconButton label="More" onClick={() => setMenuOpen((value) => !value)}>
          <MoreHorizontal size={16} />
        </IconButton>
        <Popover open={menuOpen} onClose={() => setMenuOpen(false)} className="right-0 top-10 w-[220px]">
          {day ? (
            <>
              <MenuItem icon={<NotebookPen size={16} />} onClick={() => open("day")}>
                {canEdit ? "Edit day" : "Day details"}
              </MenuItem>
              <div className="mx-1 my-1 h-px bg-line" />
            </>
          ) : null}
          {canEdit ? (
            <>
              <MenuItem icon={<CalendarDays size={16} />} onClick={() => open("dates")}>Dates &amp; days</MenuItem>
              <MenuItem icon={<Pencil size={16} />} onClick={() => open("rename")}>Rename</MenuItem>
            </>
          ) : null}
          <MenuItem
            icon={<Download size={16} />}
            onClick={() => {
              setMenuOpen(false);
              exportTrip();
            }}
          >
            Export
          </MenuItem>
          {isOwner ? (
            <>
              <div className="mx-1 my-1 h-px bg-line" />
              <MenuItem danger icon={<Trash2 size={16} />} onClick={() => open("delete")}>Delete trip</MenuItem>
            </>
          ) : null}
        </Popover>
      </div>
      {day ? <EditDayDialog day={day} open={dialog === "day"} onClose={() => setDialog(null)} /> : null}
      <DatesDialog open={dialog === "dates"} onClose={() => setDialog(null)} />
      <RenameDialog open={dialog === "rename"} onClose={() => setDialog(null)} />
      <DeleteTripDialog open={dialog === "delete"} onClose={() => setDialog(null)} />
      {isOwner ? <ShareDialog open={dialog === "share"} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
