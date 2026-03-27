import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Reminder } from "@/db/schema";
import { getActiveTripDates, getTripStatus } from "@/lib/trip-data";

interface CountdownBannerProps {
  overdueCount?: number;
  dueSoonCount?: number;
  reminders?: Reminder[];
  tripDates?: string[];
}

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

function isReminderOverdue(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${dueDate}T00:00:00`) < today;
}

function ReminderTooltip({
  reminders,
}: {
  reminders: Reminder[];
}) {
  return (
    <div className="space-y-2">
      {reminders.map((reminder) => {
        const { label, overdue } = getDueDateLabel(reminder.dueDate!);
        return (
          <div key={reminder.id} className="min-w-0 rounded-xl bg-white/70 px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{reminder.title}</p>
            <p
              className={`mt-0.5 text-xs ${
                overdue ? "font-medium text-red-600" : "text-muted-foreground"
              }`}
            >
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function CountdownBanner({
  overdueCount = 0,
  dueSoonCount = 0,
  reminders = [],
  tripDates,
}: CountdownBannerProps) {
  const dates = getActiveTripDates(tripDates);
  const status = getTripStatus(new Date(), dates);
  const overdueReminders = reminders.filter((reminder) =>
    reminder.dueDate ? isReminderOverdue(reminder.dueDate) : false
  );
  const dueSoonReminders = reminders.filter((reminder) =>
    reminder.dueDate ? !isReminderOverdue(reminder.dueDate) : false
  );

  let message = "Your trip workspace is ready";
  if (status.status === "before") {
    message = `${status.daysUntil} days until departure`;
  } else if (status.status === "during") {
    message = `Day ${status.dayNumber} of ${dates.length} in the trip`;
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/45 bg-[linear-gradient(135deg,rgba(255,255,255,0.48),rgba(245,244,255,0.34))] px-5 py-4 shadow-[0_22px_54px_rgba(124,112,226,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl">
      <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -bottom-8 left-10 h-24 w-24 rounded-full bg-accent/20 blur-3xl" />
      <p className="relative text-xs uppercase tracking-[0.28em] text-primary/90">Trip Status</p>
      <p className="relative mt-2 text-lg font-semibold">{message}</p>
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="relative mt-3 flex flex-wrap gap-2">
          <TooltipProvider>
            {overdueCount > 0 && overdueReminders.length > 0 ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="inline-flex items-center rounded-full border border-white/50 bg-white/55 px-2.5 py-1 text-xs font-medium text-red-600 shadow-[0_8px_22px_rgba(120,126,182,0.08)] backdrop-blur-xl hover:cursor-pointer">
                      {overdueCount} reminders overdue
                    </span>
                  }
                />
                <TooltipContent
                  side="bottom"
                  sideOffset={8}
                  className="max-w-72 rounded-2xl border-white/50 bg-white/95 p-3 text-left font-normal shadow-[0_18px_40px_rgba(28,31,46,0.14)]"
                >
                  <ReminderTooltip reminders={overdueReminders} />
                </TooltipContent>
              </Tooltip>
            ) : null}
            {dueSoonCount > 0 && dueSoonReminders.length > 0 ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="inline-flex items-center rounded-full border border-white/50 bg-white/55 px-2.5 py-1 text-xs font-medium text-yellow-700 shadow-[0_8px_22px_rgba(120,126,182,0.08)] backdrop-blur-xl hover:cursor-pointer">
                      {dueSoonCount} reminders due soon
                    </span>
                  }
                />
                <TooltipContent
                  side="bottom"
                  sideOffset={8}
                  className="max-w-72 rounded-2xl border-white/50 bg-white/95 p-3 text-left font-normal shadow-[0_18px_40px_rgba(28,31,46,0.14)]"
                >
                  <ReminderTooltip reminders={dueSoonReminders} />
                </TooltipContent>
              </Tooltip>
            ) : null}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
