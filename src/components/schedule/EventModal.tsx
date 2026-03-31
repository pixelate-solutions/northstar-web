"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Event } from "@/db/schema";
import { CATEGORIES, getCategoryConfig } from "@/lib/category-config";
import { formatTime } from "@/lib/utils";

// ─── Time helpers ─────────────────────────────────────────────────────────────

function toHHMM(raw: string | null | undefined): string {
  if (!raw) return "09:00";
  // DB returns "HH:MM:SS" — strip seconds
  return raw.slice(0, 5);
}

function toDisplayTime(raw: string | null | undefined): string {
  return formatTime(toHHMM(raw));
}

function normalizeTimeValue(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "");

  if (!cleaned) return null;

  const meridiemMatch = cleaned.match(/(am|pm|a|p)$/);
  const meridiem = meridiemMatch ? meridiemMatch[0][0] : null;
  const core = meridiemMatch
    ? cleaned.slice(0, -meridiemMatch[0].length)
    : cleaned;

  let hoursText = "";
  let minutesText = "";

  if (core.includes(":")) {
    const [rawHours = "", rawMinutes = ""] = core.split(":");
    hoursText = rawHours.replace(/\D/g, "");
    minutesText = rawMinutes.replace(/\D/g, "");
  } else {
    const digits = core.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length <= 2) {
      hoursText = digits;
      minutesText = "00";
    } else if (digits.length === 3) {
      hoursText = digits.slice(0, 1);
      minutesText = digits.slice(1);
    } else if (digits.length === 4) {
      hoursText = digits.slice(0, 2);
      minutesText = digits.slice(2);
    } else {
      return null;
    }
  }

  if (!hoursText) return null;

  const hours = Number(hoursText);
  const minutes = Number(
    minutesText.length === 1 ? `${minutesText}0` : minutesText || "0"
  );

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return null;
  }

  let normalizedHours = hours;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "p" && hours !== 12) normalizedHours += 12;
    if (meridiem === "a" && hours === 12) normalizedHours = 0;
  } else if (hours > 23) {
    return null;
  }

  return `${String(normalizedHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTypedTimeInput(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^0-9apm:\s]/g, "")
    .replace(/\s+/g, "");

  if (!cleaned) return "";

  const meridiemMatch = cleaned.match(/(am|pm|a|p)$/);
  const meridiem = meridiemMatch
    ? ` ${meridiemMatch[0][0].toUpperCase()}M`
    : "";
  const core = meridiemMatch
    ? cleaned.slice(0, -meridiemMatch[0].length)
    : cleaned;

  if (!core) return meridiem.trim();

  if (core.includes(":")) {
    const [rawHours = "", rawMinutes = ""] = core.split(":");
    const hours = rawHours.replace(/\D/g, "").slice(0, 2);
    const minutes = rawMinutes.replace(/\D/g, "").slice(0, 2);
    return `${hours}${rawMinutes !== undefined ? ":" : ""}${minutes}${meridiem}`.trim();
  }

  const digits = core.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return `${digits}${meridiem}`.trim();
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}${meridiem}`.trim();
  return `${digits.slice(0, 2)}:${digits.slice(2)}${meridiem}`.trim();
}

function formatDateLabel(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Address autocomplete (Nominatim / OpenStreetMap) ─────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function AddressAutocomplete({
  value,
  onChange,
  onGeocode,
  onManualEdit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onGeocode: (lat: string, lng: string) => void;
  onManualEdit: () => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function computeDropdownStyle(resultCount: number) {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const itemHeight = 52;
    const maxHeight = 224; // max-h-56
    const dropH = Math.min(resultCount * itemHeight, maxHeight);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top = spaceBelow >= dropH ? rect.bottom + 4 : rect.top - dropH - 4;
    setDropdownStyle({ top, left: rect.left, width: rect.width });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    onChange(q);
    onManualEdit();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=0`,
            { headers: { "Accept-Language": "en-US,en" } }
          );
          const data = (await res.json()) as NominatimResult[];
          setSuggestions(data);
          if (data.length > 0) {
            computeDropdownStyle(data.length);
            setOpen(true);
          } else {
            setOpen(false);
          }
        } catch {
          setSuggestions([]);
          setOpen(false);
        }
      })();
    }, 350);
  }

  function handleSelect(result: NominatimResult) {
    onChange(result.display_name);
    onGeocode(result.lat, result.lon);
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        inputRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", zIndex: 9999, ...dropdownStyle }}
          className="max-h-56 overflow-y-auto rounded-xl border border-border/70 bg-card shadow-lg"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary/70 ${
                i < suggestions.length - 1 ? "border-b border-border/40" : ""
              }`}
            >
              <span className="line-clamp-2 leading-snug">{s.display_name}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const formSchema = z.object({
  title: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  startTime: z
    .string()
    .min(1, "Start time is required")
    .refine((value) => Boolean(normalizeTimeValue(value)), {
      message: "Use a time like 9, 930, 9:30, or 730p",
    }),
  endTime: z
    .string()
    .min(1, "End time is required")
    .refine((value) => Boolean(normalizeTimeValue(value)), {
      message: "Use a time like 10, 1030, 10:30, or 8p",
    }),
  location: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  tip: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function getEventFormDefaults(event?: Event | null): FormValues {
  return {
    title: event?.title ?? "",
    category: event?.category ?? "other",
    startTime: toDisplayTime(event?.startTime),
    endTime:
      toHHMM(event?.endTime) === "09:00" && !event
        ? "10:00 AM"
        : toDisplayTime(event?.endTime),
    location: event?.location ?? "",
    lat: event?.lat ?? "",
    lng: event?.lng ?? "",
    tip: event?.tip ?? "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EventModalProps {
  dayId: number;
  date?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event | null;
  nextSortOrder?: number;
  onSaved?: () => void;
}

export function EventModal({
  dayId,
  date,
  open,
  onOpenChange,
  event,
  nextSortOrder = 0,
  onSaved,
}: EventModalProps) {
  const [locationMode, setLocationMode] = useState<"address" | "coords">(() =>
    event?.lat && event?.lng ? "coords" : "address"
  );
  // Geocoded coords from autocomplete selection — saved alongside address text
  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: string; lng: string } | null>(
    null
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getEventFormDefaults(event),
  });

  async function onSubmit(data: FormValues) {
    const normalizedStartTime = normalizeTimeValue(data.startTime);
    const normalizedEndTime = normalizeTimeValue(data.endTime);

    if (!normalizedStartTime || !normalizedEndTime) {
      if (!normalizedStartTime) {
        form.setError("startTime", {
          type: "validate",
          message: "Use a time like 9, 930, 9:30, or 730p",
        });
      }
      if (!normalizedEndTime) {
        form.setError("endTime", {
          type: "validate",
          message: "Use a time like 10, 1030, 10:30, or 8p",
        });
      }
      return;
    }

    // In address mode: save geocoded lat/lng alongside the address text when available
    const usingGeocode = locationMode === "address" && geocodedCoords;

    const payload = {
      dayId,
      title: data.title,
      category: data.category,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      description: event?.description ?? "",
      location: locationMode === "address" ? (data.location ?? "") : "",
      lat: locationMode === "coords" ? (data.lat ?? null) : (usingGeocode ? geocodedCoords.lat : null),
      lng: locationMode === "coords" ? (data.lng ?? null) : (usingGeocode ? geocodedCoords.lng : null),
      tip: data.tip ?? "",
      cost: event?.cost ?? "",
      isBooked: event?.isBooked ?? false,
      sortOrder: event?.sortOrder ?? nextSortOrder,
    };

    const url = event ? `/api/events/${event.id}` : "/api/events";
    const method = event ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Unable to save event.");
      return;
    }

    toast.success(event ? "Event updated." : "Event added.");
    onOpenChange(false);
    onSaved?.();
  }

  const locationValue = useWatch({
    control: form.control,
    name: "location",
  }) ?? "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card p-4 sm:p-7 max-h-[90dvh] overflow-y-auto ">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Add Event"}</DialogTitle>
          {date ? (
            <p className="text-sm text-muted-foreground">{formatDateLabel(date)}</p>
          ) : null}
        </DialogHeader>

        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((values) => void onSubmit(values))}
        >
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="ev-title">Name</Label>
            <Input
              id="ev-title"
              placeholder="e.g. Breakfast at Sedonuts"
              {...form.register("title")}
            />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>

          {/* Category */}
          <div className="grid gap-2">
            <Label>Category</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {CATEGORIES.map((cat) => {
                      const config = getCategoryConfig(cat);
                      return (
                        <SelectItem className="hover:cursor-pointer hover:bg-orange-400/20" key={cat} value={cat}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-2.5 rounded-full"
                              style={{ background: config.color }}
                            />
                            {config.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ev-start">Start Time</Label>
              <Controller
                control={form.control}
                name="startTime"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      id="ev-start"
                      type="text"
                      inputMode="text"
                      placeholder="9, 930, 9:30, 730p"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(formatTypedTimeInput(e.target.value));
                        if (form.formState.errors.startTime) {
                          void form.trigger("startTime");
                        }
                      }}
                      onBlur={() => {
                        field.onBlur();
                        const normalized = normalizeTimeValue(field.value ?? "");
                        if (normalized) {
                          field.onChange(formatTime(normalized));
                        }
                      }}
                    />
                    {fieldState.error ? (
                      <p className="text-xs text-destructive">
                        {fieldState.error.message}
                      </p>
                    ) : null}
                  </>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ev-end">End Time</Label>
              <Controller
                control={form.control}
                name="endTime"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      id="ev-end"
                      type="text"
                      inputMode="text"
                      placeholder="10, 1030, 10:30, 8p"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(formatTypedTimeInput(e.target.value));
                        if (form.formState.errors.endTime) {
                          void form.trigger("endTime");
                        }
                      }}
                      onBlur={() => {
                        field.onBlur();
                        const normalized = normalizeTimeValue(field.value ?? "");
                        if (normalized) {
                          field.onChange(formatTime(normalized));
                        }
                      }}
                    />
                    {fieldState.error ? (
                      <p className="text-xs text-destructive">
                        {fieldState.error.message}
                      </p>
                    ) : null}
                  </>
                )}
              />
            </div>
          </div>

          {/* Location — Address or Coordinates */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label>Location</Label>
                {geocodedCoords && locationMode === "address" ? (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600">
                    pinned
                  </span>
                ) : null}
              </div>
              <div className="flex rounded-lg border border-border/70 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLocationMode("address")}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    locationMode === "address"
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Address
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMode("coords")}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    locationMode === "coords"
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Coordinates
                </button>
              </div>
            </div>
            {locationMode === "address" ? (
              <AddressAutocomplete
                value={locationValue}
                onChange={(v) => form.setValue("location", v)}
                onGeocode={(lat, lng) => setGeocodedCoords({ lat, lng })}
                onManualEdit={() => setGeocodedCoords(null)}
                placeholder="e.g. Sugar Loaf Loop Trailhead, Sedona, AZ"
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Latitude" {...form.register("lat")} />
                <Input placeholder="Longitude" {...form.register("lng")} />
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ev-tip">Notes</Label>
            <Textarea
              id="ev-tip"
              rows={3}
              placeholder="Add anything useful to remember for this event."
              {...form.register("tip")}
            />
          </div>

          <DialogFooter className="gap-2 bg-transparent p-0 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {event ? "Save Changes" : "Add Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
