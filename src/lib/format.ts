const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function parseDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function shortDate(date: string | null | undefined) {
  if (!date) return "";
  const value = parseDate(date);
  return `${MONTHS[value.getUTCMonth()]} ${value.getUTCDate()}`;
}

export function weekday(date: string) {
  return WEEKDAYS[parseDate(date).getUTCDay()];
}

export function dayChipLabel(date: string) {
  return `${weekday(date)} ${parseDate(date).getUTCDate()}`;
}

export function dateRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "";
  if (!end || end === start) return shortDate(start);
  const a = parseDate(start);
  const b = parseDate(end);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${shortDate(start)} – ${b.getUTCDate()}`;
  return `${shortDate(start)} – ${shortDate(end)}`;
}

/** "07:00:00" -> "07:00" */
export function clock(time: string | null | undefined) {
  if (!time) return "";
  return time.slice(0, 5);
}

/** "19:30:00" -> "7:30 PM" (or "19:30" with 24-hour time on). */
export function displayClock(time: string | null | undefined, use24Hour: boolean) {
  const value = clock(time);
  if (!value || use24Hour) return value;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Accepts "9", "930", "9:30", "7:30p", "19:30" and returns "HH:MM" or null. */
export function parseClock(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3];
  if (meridiem?.startsWith("p") && hours < 12) hours += 12;
  if (meridiem?.startsWith("a") && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function money(value: number | string | null | undefined, cents = false) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export function duration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function miles(meters: number) {
  const value = meters / 1609.344;
  return `${value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString("en-US")} mi`;
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
