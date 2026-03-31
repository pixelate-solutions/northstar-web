"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { ArrowRight, ImageUp, Map, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { WeatherChip } from "@/components/shared/WeatherChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DaySummary } from "@/lib/types";

interface TripBuilderProps {
  initialDays: DaySummary[];
  canEdit: boolean;
}

interface DayDraft {
  id: number;
  sourceDate: string;
  date: string;
  dayNumber: number;
  title: string;
  location: string;
  sleepLocation: string;
  driveInfo: string;
  notes: string;
  coverImageUrl: string;
  eventCount: number;
  locationCount: number;
}

function toDayDrafts(days: DaySummary[]): DayDraft[] {
  return [...days]
    .sort((a, b) => a.dayNumber - b.dayNumber || a.date.localeCompare(b.date))
    .map((day) => ({
      id: day.id,
      sourceDate: day.date,
      date: day.date,
      dayNumber: day.dayNumber,
      title: day.title,
      location: day.location,
      sleepLocation: day.sleepLocation ?? "",
      driveInfo: day.driveInfo ?? "",
      notes: day.notes ?? "",
      coverImageUrl: day.coverImageUrl ?? "",
      eventCount: day.eventCount,
      locationCount: day.locations.length,
    }));
}

export function TripBuilder({ initialDays, canEdit }: TripBuilderProps) {
  const router = useRouter();
  const [days, setDays] = useState(() => toDayDrafts(initialDays));
  const [startDate, setStartDate] = useState(initialDays[0]?.date ?? "");
  const [totalDays, setTotalDays] = useState(String(initialDays.length || 1));
  const [savingTrip, setSavingTrip] = useState(false);
  const [savingDayId, setSavingDayId] = useState<number | null>(null);
  const [uploadingDayId, setUploadingDayId] = useState<number | null>(null);

  function updateDay(id: number, field: keyof DayDraft, value: string) {
    setDays((current) =>
      current.map((day) => (day.id === id ? { ...day, [field]: value } : day))
    );
  }

  async function handleCoverUpload(id: number, file: File | null) {
    if (!canEdit) {
      return;
    }

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Images must be 5 MB or smaller.");
      return;
    }

    setUploadingDayId(id);

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      updateDay(id, "coverImageUrl", result);
      setUploadingDayId(null);
      toast.success("Cover image added. Save the day to keep it.");
    };
    reader.onerror = () => {
      setUploadingDayId(null);
      toast.error("Unable to read that image.");
    };

    reader.readAsDataURL(file);
  }

  async function saveTripSettings() {
    if (!canEdit) return;
    if (!startDate) {
      toast.error("Choose a trip start date.");
      return;
    }

    const parsedTotalDays = Number(totalDays);
    if (!Number.isInteger(parsedTotalDays) || parsedTotalDays < 1 || parsedTotalDays > 60) {
      toast.error("Trip length must be between 1 and 60 days.");
      return;
    }

    if (parsedTotalDays < days.length) {
      const removedDays = days.slice(parsedTotalDays);
      const hasAttachedContent = removedDays.some(
        (day) =>
          day.eventCount > 0 ||
          day.locationCount > 0 ||
          Boolean(day.notes || day.driveInfo || day.sleepLocation || day.location || day.title)
      );

      if (
        hasAttachedContent &&
        !window.confirm(
          "Reducing the trip length will remove the extra days and any events or locations attached to them. Continue?"
        )
      ) {
        return;
      }
    }

    setSavingTrip(true);
    const response = await fetch("/api/days", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        totalDays: parsedTotalDays,
      }),
    });

    const body = (await response.json().catch(() => null)) as DaySummary[] | { error?: string } | null;
    setSavingTrip(false);

    if (!response.ok) {
      toast.error(
        body && !Array.isArray(body) && body.error
          ? body.error
          : "Unable to update the trip structure."
      );
      return;
    }

    const nextDays = Array.isArray(body) ? body : [];
    setDays(toDayDrafts(nextDays));
    setStartDate(nextDays[0]?.date ?? startDate);
    setTotalDays(String(nextDays.length || parsedTotalDays));
    toast.success("Days updated.");
    startTransition(() => router.refresh());
  }

  async function saveDay(day: DayDraft) {
    if (!canEdit) return;
    if (!day.date || !day.title.trim()) {
      toast.error("Each day needs a date and title.");
      return;
    }

    if (days.some((item) => item.id !== day.id && item.date === day.date)) {
      toast.error("Each day must have a unique date.");
      return;
    }

    setSavingDayId(day.id);
    const response = await fetch(`/api/days/${day.sourceDate}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: day.date,
        dayNumber: day.dayNumber,
        title: day.title,
        location: day.location,
        sleepLocation: day.sleepLocation,
        driveInfo: day.driveInfo,
        notes: day.notes,
        coverImageUrl: day.coverImageUrl,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { date?: string; error?: string }
      | null;
    setSavingDayId(null);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to save this day.");
      return;
    }

    setDays((current) =>
      current.map((item) =>
        item.id === day.id
          ? {
              ...item,
              sourceDate: body?.date ?? day.date,
              date: body?.date ?? day.date,
              title: day.title,
              location: day.location,
              sleepLocation: day.sleepLocation,
              driveInfo: day.driveInfo,
              notes: day.notes,
              coverImageUrl: day.coverImageUrl,
            }
          : item
      )
    );
    toast.success(`Saved ${day.title}.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="min-w-0 w-full space-y-6 overflow-x-hidden">
      <Card className="min-w-0 rounded-[2rem] border border-border/70 bg-card/80">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle>Days</CardTitle>
            <p className="text-sm text-muted-foreground">
              Set the trip start date, total number of days, and keep each day linked
              to its detailed schedule page.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href="/app/calendar">
              <Button variant="outline" className="w-full sm:w-auto">
                <Map className="size-4" />
                Trip
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 min-w-0 gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="trip-start-date">Trip Start Date</Label>
            <DatePicker
              id="trip-start-date"
              value={startDate}
              onChange={setStartDate}
              disabled={!canEdit}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="trip-total-days">Number Of Days</Label>
            <Input
              id="trip-total-days"
              type="number"
              min={1}
              max={60}
              value={totalDays}
              onChange={(event) => setTotalDays(event.target.value)}
              disabled={!canEdit}
            />
          </div>
          <Button
            onClick={() => void saveTripSettings()}
            disabled={!canEdit || savingTrip}
            className="w-full md:w-auto"
          >
            {savingTrip ? "Saving..." : "Save Days"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5">
        {days.map((day) => (
          <Card
            key={day.id}
            className="min-w-0 rounded-[2rem] border border-border/70 bg-card/80 shadow-[0_18px_42px_rgba(191,102,62,0.05)]"
          >
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="max-w-full h-auto whitespace-normal bg-secondary/70 text-foreground break-words">
                    Day {day.dayNumber}
                  </Badge>
                  <Badge className="max-w-full h-auto whitespace-normal bg-secondary/70 text-foreground break-words">
                    {day.eventCount} events
                  </Badge>
                  <Badge className="max-w-full h-auto whitespace-normal bg-secondary/70 text-foreground break-words">
                    {day.locationCount} locations
                  </Badge>
                  {day.location ? (
                    <WeatherChip location={day.location} date={day.date} />
                  ) : null}
                </div>

                <CardTitle className="min-w-0 text-xl break-words">
                  {day.title || `Day ${day.dayNumber}`}
                </CardTitle>

                <p className="min-w-0 text-sm text-muted-foreground break-words">
                  Use the quick editor here, then jump into the detailed day page for
                  schedule and location work.
                </p>
              </div>

              <div className="min-w-0 w-full shrink-0 sm:w-auto sm:shrink">
                <Link href={`/app/days/${day.sourceDate}`} className="block min-w-0 w-full sm:w-auto">
                  <Button variant="outline" className="flex w-full min-w-0 max-w-full sm:w-auto">
                    <span className="min-w-0 truncate sm:whitespace-nowrap">Open Day Detail</span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-5">
              <div className="grid grid-cols-1 min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`date-${day.id}`}>Date</Label>
                  <DatePicker
                    id={`date-${day.id}`}
                    value={day.date}
                    onChange={(value) => updateDay(day.id, "date", value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="min-w-0 space-y-2 xl:col-span-2">
                  <Label htmlFor={`title-${day.id}`}>Day Name</Label>
                  <Input
                    id={`title-${day.id}`}
                    value={day.title}
                    onChange={(event) => updateDay(day.id, "title", event.target.value)}
                    placeholder="Sedona Day"
                    disabled={!canEdit}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`location-${day.id}`}>Location</Label>
                  <Input
                    id={`location-${day.id}`}
                    value={day.location}
                    onChange={(event) => updateDay(day.id, "location", event.target.value)}
                    placeholder="Sedona, AZ"
                    disabled={!canEdit}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`sleep-${day.id}`}>Sleep Location</Label>
                  <Input
                    id={`sleep-${day.id}`}
                    value={day.sleepLocation}
                    onChange={(event) =>
                      updateDay(day.id, "sleepLocation", event.target.value)
                    }
                    placeholder="Springdale, UT"
                    disabled={!canEdit}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`drive-${day.id}`}>Drive Overview</Label>
                  <Input
                    id={`drive-${day.id}`}
                    value={day.driveInfo}
                    onChange={(event) => updateDay(day.id, "driveInfo", event.target.value)}
                    placeholder="2 hr 15 min via AZ-179"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`cover-${day.id}`}>Cover Image URL</Label>
                <Input
                  id={`cover-${day.id}`}
                  value={day.coverImageUrl}
                  onChange={(event) => updateDay(day.id, "coverImageUrl", event.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  disabled={!canEdit}
                />
              </div>

              <div className="grid grid-cols-1 min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`cover-upload-${day.id}`}>Upload Cover Image</Label>
                  <Input
                    id={`cover-upload-${day.id}`}
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      void handleCoverUpload(day.id, file);
                    }}
                    className="sr-only"
                    disabled={!canEdit}
                  />
                  <Label
                    htmlFor={`cover-upload-${day.id}`}
                    className="flex w-full cursor-pointer items-center justify-center rounded-full border border-white/50 bg-white/50 px-4 py-3 text-center text-sm font-medium text-foreground shadow-[0_10px_24px_rgba(120,126,182,0.10)] transition hover:bg-white/65"
                  >
                    {uploadingDayId === day.id ? "Processing image..." : "Choose Image"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload an image or paste a URL above.
                  </p>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label>Preview</Label>
                  <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-secondary/30">
                    {day.coverImageUrl ? (
                      <div className="relative h-40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={day.coverImageUrl}
                          alt={`${day.title} cover`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => updateDay(day.id, "coverImageUrl", "")}
                          className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full border border-white/60 bg-white/80 text-foreground shadow-sm backdrop-blur hover:cursor-pointer"
                          aria-label={`Remove cover image for ${day.title}`}
                          disabled={!canEdit}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <ImageUp className="size-5" />
                        <p className="text-xs">No cover image selected</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`notes-${day.id}`}>Notes</Label>
                <Textarea
                  id={`notes-${day.id}`}
                  rows={4}
                  value={day.notes}
                  onChange={(event) => updateDay(day.id, "notes", event.target.value)}
                  placeholder="Reservations, parking notes, backup plan, or anything else for this day."
                  disabled={!canEdit}
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-sm text-muted-foreground">
                  Saving here updates the day metadata used throughout the dashboard.
                </p>
                <Button
                  onClick={() => void saveDay(day)}
                  disabled={!canEdit || savingDayId === day.id}
                  className="w-full sm:w-auto"
                >
                  <Save className="size-4" />
                  {savingDayId === day.id ? "Saving..." : "Save Day"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
