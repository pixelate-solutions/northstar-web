"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bell } from "lucide-react";
import { useRouter } from "next/navigation";

import { CountdownBanner } from "@/components/dashboard/CountdownBanner";
import { NextEventCard } from "@/components/dashboard/NextEventCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { TodaySnapshot } from "@/components/dashboard/TodaySnapshot";
import { DatabaseBanner } from "@/components/shared/DatabaseBanner";
import { PageHeader } from "@/components/shared/PageHeader";
import { WeatherChip } from "@/components/shared/WeatherChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Reminder } from "@/db/schema";
import { getDashboardStats } from "@/lib/dashboard";
import type { AppDataBundle } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

interface DashboardClientProps {
  bundle: AppDataBundle;
  defaultDate: string;
  databaseWarning: string | null;
}

const priorityStyles = {
  high: "bg-red-500/10 text-red-700",
  medium: "bg-yellow-500/10 text-yellow-700",
  low: "bg-green-500/10 text-green-700",
};

function getDueDateLabel(dueDate: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: "Due today", overdue: false };
  if (diff === 1) return { label: "Due tomorrow", overdue: false };
  return { label: `In ${diff} days`, overdue: false };
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
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  const selectedDay =
    bundle.days.find((day) => day.date === selectedDate) ?? bundle.days[0];
  const stats = useMemo(
    () => getDashboardStats(bundle, selectedDate),
    [bundle, selectedDate]
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
      <CountdownBanner overdueCount={reminderCounts.overdue} dueSoonCount={reminderCounts.dueSoon} />

      <div className="flex gap-3 flex-wrap">
        {bundle.days.map((day) => (
          <button
            key={day.date}
            type="button"
            aria-label={`Select ${day.title}`}
            onClick={() => setSelectedDate(day.date)}
            onDoubleClick={() => router.push(`/days/${day.date}`)}
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

          {actionableReminders.length > 0 && (
            <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.28em] text-primary/80">
                  Reminders
                </p>
                <Bell className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-4 space-y-2">
                {actionableReminders.map((reminder) => {
                  const { label, overdue } = getDueDateLabel(reminder.dueDate!);
                  return (
                    <div
                      key={reminder.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-secondary/30 px-3.5 py-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">{reminder.title}</p>
                        <p
                          className={`text-xs ${
                            overdue
                              ? "font-medium text-red-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {label}
                        </p>
                      </div>
                      <Badge
                        className={`shrink-0 text-xs ${
                          priorityStyles[
                            reminder.priority as keyof typeof priorityStyles
                          ]
                        }`}
                      >
                        {reminder.priority}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              <Link
                href="/reminders"
                className="mt-3 flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                View all reminders
                <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
