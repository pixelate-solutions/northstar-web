"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { CountdownBanner } from "@/components/dashboard/CountdownBanner";
import { NextEventCard } from "@/components/dashboard/NextEventCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { TodaySnapshot } from "@/components/dashboard/TodaySnapshot";
import { DatabaseBanner } from "@/components/shared/DatabaseBanner";
import { MobileDayNavigator } from "@/components/shared/MobileDayNavigator";
import { PageHeader } from "@/components/shared/PageHeader";
import { WeatherChip } from "@/components/shared/WeatherChip";
import { Button } from "@/components/ui/button";
import type { Reminder } from "@/db/schema";
import { useCurrentTimeZone } from "@/hooks/useCurrentTimeZone";
import { getDashboardStats } from "@/lib/dashboard";
import type { AppDataBundle } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

interface DashboardClientProps {
  bundle: AppDataBundle;
  defaultDate: string;
  databaseWarning: string | null;
}

function getActionableReminders(reminders: Reminder[]): Reminder[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 14);
  return reminders
    .filter((r) => !r.isDone && r.dueDate)
    .filter((r) => new Date(`${r.dueDate}T00:00:00`) <= cutoff)
    .sort(
      (a, b) =>
        new Date(`${a.dueDate}T00:00:00`).getTime() -
        new Date(`${b.dueDate}T00:00:00`).getTime()
    );
}

function getReminderCounts(reminders: Reminder[]): { overdue: number; dueSoon: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 14);
  let overdue = 0;
  let dueSoon = 0;
  for (const r of reminders) {
    if (r.isDone || !r.dueDate) continue;
    const due = new Date(`${r.dueDate}T00:00:00`);
    if (due < today) overdue++;
    else if (due <= soon) dueSoon++;
  }
  return { overdue, dueSoon };
}

export function DashboardClient({
  bundle,
  defaultDate,
  databaseWarning,
}: DashboardClientProps) {
  const router = useRouter();
  const timeZone = useCurrentTimeZone();
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const selectedDay =
    bundle.days.find((day) => day.date === selectedDate) ?? bundle.days[0];
  const selectedDayIndex = bundle.days.findIndex((day) => day.date === selectedDate);
  const tripDates = useMemo(() => bundle.days.map((day) => day.date), [bundle.days]);
  const stats = useMemo(
    () => getDashboardStats(bundle, selectedDate, timeZone),
    [bundle, selectedDate, timeZone]
  );
  const actionableReminders = useMemo(
    () => getActionableReminders(bundle.reminders),
    [bundle.reminders]
  );
  const reminderCounts = useMemo(
    () => getReminderCounts(bundle.reminders),
    [bundle.reminders]
  );

  if (!selectedDay) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description="Live schedule, countdown, and quick planning stats for your active trip."
        actions={
          <Link href={`/app/days/${selectedDay.date}`} className="hidden sm:block">
            <Button>
              Open Day Detail
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        }
      />

      <DatabaseBanner message={databaseWarning} />
      <CountdownBanner
        overdueCount={reminderCounts.overdue}
        dueSoonCount={reminderCounts.dueSoon}
        reminders={actionableReminders}
        tripDates={tripDates}
        timeZone={timeZone}
      />
      <div className="sm:hidden">
        <Link href={`/app/days/${selectedDay.date}`}>
          <Button className="w-full">
            Open Day Detail
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>

      <MobileDayNavigator
        className="sm:hidden"
        days={bundle.days}
        selectedIndex={selectedDayIndex >= 0 ? selectedDayIndex : 0}
        onSelectIndex={(index) => {
          if (index === null) {
            return;
          }

          const day = bundle.days[index];
          if (day) {
            setSelectedDate(day.date);
          }
        }}
      />

      <div className="hidden flex-wrap gap-3 sm:flex">
        {bundle.days.map((day) => (
          <button
            key={day.date}
            type="button"
            aria-label={`Select ${day.title}`}
            onClick={() => setSelectedDate(day.date)}
            onDoubleClick={() => router.push(`/app/days/${day.date}`)}
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
        <div className="min-w-0 space-y-6">
          <TodaySnapshot day={selectedDay} />
          <div className="flex items-center gap-3">
            <WeatherChip location={selectedDay.location} />
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <NextEventCard
            events={selectedDay.events}
            selectedDate={selectedDay.date}
          />
        </div>
      </div>
    </div>
  );
}
