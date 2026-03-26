"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  function computePopoverStyle() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top =
      spaceBelow >= popoverHeight ? rect.bottom + 4 : rect.top - popoverHeight - 4;
    setPopoverStyle({ top, left: rect.left, minWidth: rect.width });
  }

  function handleToggle() {
    if (!open) computePopoverStyle();
    setOpen((prev) => !prev);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-input/30 px-3 text-left text-sm transition hover:bg-secondary/50",
          !selected && "text-muted-foreground",
          className
        )}
      >
        <CalendarIcon className="size-4 shrink-0 opacity-50" />
        {selected ? format(selected, "MMM d, yyyy") : placeholder}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", zIndex: 9999, ...popoverStyle }}
            className="rounded-2xl border border-border/70 bg-card p-3 shadow-[0_8px_32px_rgba(100,116,180,0.14)]"
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(date) => {
                onChange(date ? format(date, "yyyy-MM-dd") : "");
                setOpen(false);
              }}
              styles={{
                root: { fontFamily: "inherit", fontSize: "0.875rem" },
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
