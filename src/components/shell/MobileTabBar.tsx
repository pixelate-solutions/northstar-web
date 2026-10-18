"use client";

import { ListChecks, Map as MapIcon, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { StarMark } from "@/components/brand/Logo";
import { useTrip } from "@/components/trip/TripProvider";

export function MobileTabBar() {
  const pathname = usePathname();
  const { openAsk, canEdit, ask } = useTrip();
  if (ask.open) return null;
  const tabs = [
    { href: "/app", label: "Plan", icon: MapIcon, active: pathname === "/app" || pathname.startsWith("/app/days") },
    { href: "/app/lists", label: "Lists", icon: ListChecks, active: pathname.startsWith("/app/lists") },
    { href: "/app/budget", label: "Budget", icon: Wallet, active: pathname.startsWith("/app/budget") },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[800] flex items-center gap-1 border-t border-line bg-white px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2.5 lg:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link key={tab.href} href={tab.href} className="flex w-16 flex-col items-center gap-[3px]">
            <Icon size={22} strokeWidth={2.2} className={tab.active ? "text-ink" : "text-faint"} />
            <span className={`text-[11px] ${tab.active ? "font-bold text-ink" : "font-semibold text-faint"}`}>{tab.label}</span>
          </Link>
        );
      })}
      <div className="flex-1" />
      {canEdit ? (
        <button
          type="button"
          onClick={() => openAsk()}
          className="flex h-12 items-center gap-2 rounded-full bg-ink px-[18px] text-[15px] font-bold text-white"
        >
          <StarMark size={16} color="#FFC500" core={null} />
          Ask
        </button>
      ) : null}
    </nav>
  );
}
