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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const timeZone = useCurrentTimeZone();
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const selectedDay =
    bundle.days.find((day) => day.date === selectedDate) ?? bundle.days[0];
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

      <div className="flex">
        <Select
          value={selectedDay.date}
          onValueChange={(date) => {
            if (date) {
              setSelectedDate(date);
            }
          }}
        >
          <SelectTrigger className="h-auto max-w-full rounded-full border-0 bg-secondary px-4 py-2 text-base font-semibold text-foreground shadow-none hover:bg-secondary/80 focus-visible:ring-primary/20 data-[size=default]:h-auto">
            <SelectValue>{formatDateShort(selectedDay.date)}</SelectValue>
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            className="max-h-72 min-w-64 overflow-y-auto"
          >
            {bundle.days.map((day) => (
              <SelectItem
                key={day.id}
                value={day.date}
                className="hover:cursor-pointer hover:bg-accent/10 focus:bg-accent/10 focus:text-foreground"
              >
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="font-medium">
                    Day {day.dayNumber} · {formatDateShort(day.date)}
                  </span>
                  <span className="max-w-56 truncate text-xs text-muted-foreground">
                    {day.title}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
