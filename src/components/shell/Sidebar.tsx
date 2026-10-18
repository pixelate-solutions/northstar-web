"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { ListChecks, LogOut, Map as MapIcon, PanelLeftClose, PanelLeftOpen, Route, Settings2, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { MenuItem, Popover } from "@/components/ns/overlay";
import { PreferencesDialog } from "@/components/plan/TripDialogs";
import { TripSwitcher, TripTile } from "@/components/shell/TripSwitcher";
import { useTrip } from "@/components/trip/TripProvider";
import { money, shortDate } from "@/lib/format";

export function Sidebar() {
  const pathname = usePathname();
  const { bundle } = useTrip();
  const openTodos = bundle.reminders.filter((reminder) => !reminder.isDone).length;
  const total = bundle.expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const onPlan = pathname === "/app" || pathname.startsWith("/app/days");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  const nav = [
    { href: "/app", label: "Plan", icon: MapIcon, active: onPlan, meta: null },
    { href: "/app/lists", label: "Lists", icon: ListChecks, active: pathname.startsWith("/app/lists"), meta: openTodos ? String(openTodos) : null },
    { href: "/app/budget", label: "Budget", icon: Wallet, active: pathname.startsWith("/app/budget"), meta: total ? money(total) : null },
  ];

  if (collapsed) {
    return (
      <aside className="hidden h-full w-[68px] shrink-0 flex-col items-center gap-4 bg-surface py-4 lg:flex">
        <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-white hover:text-ink">
          <PanelLeftOpen size={18} />
        </button>
        <Link href="/app" title={bundle.trip.name} aria-label={bundle.trip.name}>
          <TripTile id={bundle.trip.id} name={bundle.trip.name} active size={36} />
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition ${item.active ? "bg-white text-ink" : "text-muted hover:bg-white/60 hover:text-ink"}`}
              >
                <Icon size={18} strokeWidth={2} />
              </Link>
            );
          })}
        </nav>
        <div className="scrollbar-hide flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
          {bundle.days.map((day) => {
            const href = `/app/days/${day.date}`;
            const active = pathname === href;
            return (
              <Link
                key={day.id}
                href={href}
                title={day.title || day.location || `Day ${day.dayNumber}`}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[12px] ${active ? "bg-lane font-semibold text-ink" : "font-medium text-muted hover:bg-white"}`}
              >
                {day.dayNumber}
              </Link>
            );
          })}
        </div>
        <ProfileButton compact onPreferences={() => setPrefsOpen(true)} />
        <PreferencesDialog open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      </aside>
    );
  }

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col gap-5 bg-surface px-3 py-4 lg:flex">
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <TripSwitcher />
        </div>
        <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar" className="mt-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted hover:bg-white hover:text-ink">
          <PanelLeftClose size={18} />
        </button>
      </div>

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

      <ProfileButton onPreferences={() => setPrefsOpen(true)} />
      <PreferencesDialog open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </aside>
  );
}

const COLLAPSED_KEY = "northstar.sidebarCollapsed";

function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(COLLAPSED_KEY) === "1");
  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
    } catch {}
  };
  return [collapsed, setCollapsed] as const;
}

/** The whole profile area is one button: profile, preferences, sign out. */
function ProfileButton({ compact, onPreferences }: { compact?: boolean; onPreferences: () => void }) {
  const { viewer } = useTrip();
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const avatar = user?.hasImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">{(viewer.name.trim()[0] ?? "N").toUpperCase()}</span>
  );
  return (
    <div className={`relative ${compact ? "" : "w-full"}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Profile"
        title={compact ? viewer.name : undefined}
        className={`flex items-center gap-2.5 rounded-[12px] transition hover:bg-white ${compact ? "p-1.5" : "w-full px-2.5 py-2 text-left"}`}
      >
        {avatar}
        {compact ? null : (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] font-semibold">{viewer.name}</span>
            {user?.primaryEmailAddress ? <span className="truncate text-[12px] font-medium text-muted">{user.primaryEmailAddress.emailAddress}</span> : null}
          </span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className={`bottom-[52px] w-[220px] ${compact ? "left-0" : "left-0 right-0"}`}>
        <MenuItem
          icon={<UserRound size={16} />}
          onClick={() => {
            setOpen(false);
            openUserProfile();
          }}
        >
          Profile
        </MenuItem>
        <MenuItem
          icon={<Settings2 size={16} />}
          onClick={() => {
            setOpen(false);
            onPreferences();
          }}
        >
          Preferences
        </MenuItem>
        <div className="mx-1 my-1 h-px bg-line" />
        <MenuItem icon={<LogOut size={16} />} onClick={() => void signOut({ redirectUrl: "/" })}>
          Sign out
        </MenuItem>
      </Popover>
    </div>
  );
}
