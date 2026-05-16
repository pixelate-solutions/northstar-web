import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours ?? "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!start) return "";
  if (!end) return formatTime(start);
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatCurrency(
  amount: string | number | null | undefined
): string {
  if (amount === null || amount === undefined || amount === "") return "$0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  return formatted.replace(/^([A-Za-z]{3}) /, "$1. ");
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  return formatted.replace(/^([A-Za-z]{3}) /, "$1. ");
}

export function formatDateMedium(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  return formatted.replace(/, ([A-Za-z]{3}) /, ", $1. ");
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return Math.abs(count) === 1 ? singular : plural;
}

function normalizeTimeForDateTime(time: string): string {
  const [hours = "00", minutes = "00", seconds = "00"] = time.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
}

export function getEventDateTime(
  dateStr: string,
  time: string | null | undefined
): Date | null {
  if (!time) return null;
  const eventDateTime = new Date(`${dateStr}T${normalizeTimeForDateTime(time)}`);
  return Number.isNaN(eventDateTime.getTime()) ? null : eventDateTime;
}

export function getEventDistanceLabel(
  dateStr: string,
  startTime: string | null | undefined,
  now = new Date()
): string | null {
  const eventDateTime = getEventDateTime(dateStr, startTime);
  if (!eventDateTime) return null;

  const diffMs = eventDateTime.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `Coming up in ${minutes} ${pluralize(minutes, "min")}`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Coming up in ${hours} hr`;

  const days = Math.round(hours / 24);
  return `Coming up in ${days} ${pluralize(days, "day")}`;
}

export function timeToMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const parts = time.split(":");
  const hours = parseInt(parts[0] ?? "0");
  const minutes = parseInt(parts[1] ?? "0");
  return hours * 60 + minutes;
}

export function sortEventsByTime<
  T extends {
    startTime: string | null;
    endTime: string | null;
    sortOrder?: number | null;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) return startDiff;

    const endDiff = timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
    if (endDiff !== 0) return endDiff;

    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

export function isEventActive(
  startTime: string | null,
  endTime: string | null,
  now = new Date()
): boolean {
  if (!startTime || !endTime) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return currentMinutes >= start && currentMinutes <= end;
}

export function isEventPast(
  endTime: string | null,
  date: string,
  now = new Date()
): boolean {
  if (!endTime) return false;
  const today = now.toISOString().split("T")[0];
  if (date < (today ?? "")) return true;
  if (date > (today ?? "")) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return timeToMinutes(endTime) < currentMinutes;
}

export function minutesUntilEvent(
  startTime: string | null,
  now = new Date()
): number {
  if (!startTime) return Infinity;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(startTime);
  return start - currentMinutes;
}
