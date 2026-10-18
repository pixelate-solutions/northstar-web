"use client";

import { CalendarDays, Hash, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { StarMark, Wordmark } from "@/components/brand/Logo";
import { api } from "@/lib/api-client";
import { todayIso } from "@/lib/format";

export function NewTripForm() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState<"draft" | "blank" | null>(null);

  async function create(mode: "draft" | "blank") {
    const place = destination.trim();
    if (!place) {
      toast.error("Where are you going?");
      return;
    }
    const totalDays = Math.max(1, Math.min(60, Number(days) || 7));
    setBusy(mode);
    try {
      await api("/api/trips", {
        method: "POST",
        body: { name: place.slice(0, 80), destination: place, startDate, totalDays },
      });
      const draft = `Draft a ${totalDays}-day plan for ${place} starting ${startDate}. Give every day a title and location, and add specific stops with times, real places, and drive times.`;
      router.push(mode === "draft" ? `/app?draft=${encodeURIComponent(draft)}` : "/app");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the trip.");
      setBusy(null);
    }
  }

  const field = "flex h-[60px] items-center gap-3 rounded-full bg-surface px-[22px]";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <nav className="flex items-center justify-between px-5 pt-5 sm:px-14 sm:pt-7">
        <Wordmark />
        <Link href="/app" aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full border border-line hover:bg-surface">
          <X size={18} />
        </Link>
      </nav>
      <form
        className="flex flex-1 items-center justify-center px-5 pb-20"
        onSubmit={(event) => {
          event.preventDefault();
          void create("draft");
        }}
      >
        <div className="flex w-full max-w-[640px] flex-col gap-4">
          <h1 className="pb-5 text-[52px] font-extrabold leading-[54px] tracking-[-0.04em] sm:text-[64px] sm:leading-[66px]">Where to?</h1>
          <label className="flex h-[68px] items-center gap-3.5 rounded-full border-2 border-ink px-6">
            <MapPin size={20} strokeWidth={2.2} />
            <input
              autoFocus
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Utah & Arizona national parks"
              className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold placeholder:font-medium placeholder:text-faint sm:text-[20px]"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className={`${field} flex-1`}>
              <CalendarDays size={18} strokeWidth={2} />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold" />
            </label>
            <label className={`${field} sm:w-[220px]`}>
              <Hash size={18} strokeWidth={2} />
              <input
                value={days}
                inputMode="numeric"
                onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 2))}
                className="w-10 bg-transparent text-[17px] font-semibold"
                aria-label="Number of days"
              />
              <span className="text-[17px] font-semibold">days</span>
            </label>
          </div>
          <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center">
            <button type="submit" disabled={busy !== null} className="flex items-center justify-center gap-2.5 rounded-full bg-lane px-7 py-[18px] text-[17px] font-bold disabled:opacity-60">
              <StarMark size={18} core={null} />
              {busy === "draft" ? "Creating…" : "Draft it for me"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void create("blank")}
              className="rounded-full border border-line px-7 py-[18px] text-[17px] font-semibold disabled:opacity-60"
            >
              {busy === "blank" ? "Creating…" : "Start blank"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
