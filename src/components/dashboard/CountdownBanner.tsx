import { getTripStatus } from "@/lib/trip-data";

export function CountdownBanner() {
  const status = getTripStatus();

  let message = "Memories from the Southwest";
  if (status.status === "before") {
    message = `${status.daysUntil} days until departure`;
  } else if (status.status === "during") {
    message = `Day ${status.dayNumber} of 11 in the Southwest`;
  }

  return (
    <div className="rounded-[2rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(234,88,12,0.08))] px-5 py-4 text-sm text-foreground shadow-[0_4px_12px_rgba(157,124,74,0.08)]">
      <p className="text-xs uppercase tracking-[0.28em] text-primary/90">Trip Status</p>
      <p className="mt-2 text-lg font-semibold">{message}</p>
    </div>
  );
}
