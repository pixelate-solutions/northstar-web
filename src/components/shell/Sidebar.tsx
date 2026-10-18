"use client";

import { UserButton } from "@clerk/nextjs";
import { ListChecks, Map as MapIcon, Route, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TripSwitcher } from "@/components/shell/TripSwitcher";
import { useTrip } from "@/components/trip/TripProvider";
import { money, shortDate } from "@/lib/format";

export function Sidebar() {
  const pathname = usePathname();
  const { bundle, viewer } = useTrip();
  const openTodos = bundle.reminders.filter((reminder) => !reminder.isDone).length;
  const total = bundle.expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const onPlan = pathname === "/app" || pathname.startsWith("/app/days");

  const nav = [
    { href: "/app", label: "Plan", icon: MapIcon, active: onPlan, meta: null },
    { href: "/app/lists", label: "Lists", icon: ListChecks, active: pathname.startsWith("/app/lists"), meta: openTodos ? String(openTodos) : null },
    { href: "/app/budget", label: "Budget", icon: Wallet, active: pathname.startsWith("/app/budget"), meta: total ? money(total) : null },
  ];

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col gap-5 bg-surface px-3 py-4 lg:flex">
      <TripSwitcher />

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-[8px] px-2.5 py-[9px] text-[15px] transition ${
                item.active ? "bg-white font-bold text-ink" : "font-semibold text-muted hover:bg-white/60 hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {item.meta ? <span className="font-mono text-[12px] font-medium text-muted">{item.meta}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-2.5 pb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Days</div>
        <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
          <Link
            href="/app"
            className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-[14px] transition ${
              pathname === "/app" ? "bg-white font-bold" : "font-semibold hover:bg-white/60"
            }`}
          >
            <span className="flex w-6 shrink-0 justify-center">
              <Route size={16} strokeWidth={2} />
            </span>
            Whole trip
          </Link>
          {bundle.days.map((day) => {
            const href = `/app/days/${day.date}`;
            const active = pathname === href;
            return (
              <Link
                key={day.id}
                href={href}
                className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-[14px] transition ${
                  active ? "bg-white font-bold" : "font-medium hover:bg-white/60"
                }`}
              >
                <span
                  className={`flex h-[22px] w-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] ${
                    active ? "bg-lane font-semibold text-ink" : "font-medium text-muted"
                  }`}
                >
                  {day.dayNumber}
                </span>
                <span className="min-w-0 flex-1 truncate">{day.title || day.location || `Day ${day.dayNumber}`}</span>
                <span className="w-11 shrink-0 text-right font-mono text-[11px] font-medium text-muted">{shortDate(day.date)}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-2.5 py-1">
        <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
        <span className="flex-1 truncate text-[14px] font-semibold">{viewer.name}</span>
      </div>
    </aside>
  );
}
