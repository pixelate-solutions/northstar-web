import { getTripStatus } from "@/lib/trip-data";

interface CountdownBannerProps {
  overdueCount?: number;
  dueSoonCount?: number;
}

export function CountdownBanner({ overdueCount = 0, dueSoonCount = 0 }: CountdownBannerProps) {
  const status = getTripStatus();

  let message = "Memories from the Southwest";
  if (status.status === "before") {
    message = `${status.daysUntil} days until departure`;
  } else if (status.status === "during") {
    message = `Day ${status.dayNumber} of 11 in the Southwest`;
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/45 bg-[linear-gradient(135deg,rgba(255,255,255,0.48),rgba(245,244,255,0.34))] px-5 py-4 shadow-[0_22px_54px_rgba(124,112,226,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl">
      <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -bottom-8 left-10 h-24 w-24 rounded-full bg-accent/20 blur-3xl" />
      <p className="relative text-xs uppercase tracking-[0.28em] text-primary/90">Trip Status</p>
      <p className="relative mt-2 text-lg font-semibold">{message}</p>
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="relative mt-3 flex flex-wrap gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex items-center rounded-full border border-white/50 bg-white/55 px-2.5 py-1 text-xs font-medium text-red-600 shadow-[0_8px_22px_rgba(120,126,182,0.08)] backdrop-blur-xl">
              {overdueCount} reminders overdue
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="inline-flex items-center rounded-full border border-white/50 bg-white/55 px-2.5 py-1 text-xs font-medium text-yellow-700 shadow-[0_8px_22px_rgba(120,126,182,0.08)] backdrop-blur-xl">
              {dueSoonCount} reminders due soon
            </span>
          )}
        </div>
      )}
    </div>
  );
}
