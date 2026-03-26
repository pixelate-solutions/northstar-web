"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { CountdownBanner } from "@/components/dashboard/CountdownBanner";
import { NextEventCard } from "@/components/dashboard/NextEventCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { TodaySnapshot } from "@/components/dashboard/TodaySnapshot";
import { DatabaseBanner } from "@/components/shared/DatabaseBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { WeatherChip } from "@/components/shared/WeatherChip";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/dashboard";
import type { AppDataBundle } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

interface DashboardClientProps {
  bundle: AppDataBundle;
  defaultDate: string;
  databaseWarning: string | null;
}

export function DashboardClient({
  bundle,
  defaultDate,
  databaseWarning,
}: DashboardClientProps) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const selectedDay =
    bundle.days.find((day) => day.date === selectedDate) ?? bundle.days[0];
  const stats = useMemo(
    () => getDashboardStats(bundle, selectedDate),
    [bundle, selectedDate]
  );

  if (!selectedDay) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trip Companion"
        title="Today View"
        description="Live schedule, countdown, and quick planning stats for the full Southwest loop."
        actions={
          <Link href={`/days/${selectedDay.date}`}>
            <Button>
              Open Day Detail
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        }
      />

      <DatabaseBanner message={databaseWarning} />
      <CountdownBanner />

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {bundle.days.map((day) => (
          <button
            key={day.date}
            type="button"
            aria-label={`Select ${day.title}`}
            onClick={() => setSelectedDate(day.date)}
            className={`min-w-fit rounded-full border px-4 py-2 text-sm transition ${
              day.date === selectedDate
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/70 bg-card/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            Day {day.dayNumber}
            <span className="ml-2 text-xs text-muted-foreground">
              {formatDateShort(day.date)}
            </span>
          </button>
        ))}
      </div>

      <QuickStats stats={stats} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <TodaySnapshot day={selectedDay} />
          <div className="flex items-center gap-3">
            <WeatherChip location={selectedDay.location} />
          </div>
          <DaySchedule
            dayId={selectedDay.id}
            date={selectedDay.date}
            events={selectedDay.events}
            editable={false}
            showAddButton={false}
          />
        </div>

        <div className="space-y-6">
          <NextEventCard
            events={selectedDay.events}
            selectedDate={selectedDay.date}
          />
          <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-primary/80">
              At A Glance
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sleep location</p>
                <p className="mt-1 font-medium text-foreground">
                  {selectedDay.sleepLocation ?? "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Drive overview</p>
                <p className="mt-1 font-medium text-foreground">
                  {selectedDay.driveInfo ?? "No drive details yet"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Notes</p>
                <p className="mt-1 font-medium text-foreground">
                  {selectedDay.notes || "Use the day detail page to add notes."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
