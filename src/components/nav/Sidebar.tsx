"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryNavItems } from "@/lib/navigation";
import { cn, formatCurrency } from "@/lib/utils";

interface SidebarProps {
  packingPercent: number;
  totalBooked: number;
  countdownLabel: string;
}

export function Sidebar({
  packingPercent,
  totalBooked,
  countdownLabel,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border/80 bg-card/70 px-5 py-6 backdrop-blur lg:flex lg:flex-col">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.32em] text-primary/80">
          SW Road Trip
        </p>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Southwest &apos;26</h1>
          <p className="text-sm text-muted-foreground">{countdownLabel}</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-2">
        {primaryNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                isActive
                  ? "border-primary/30 bg-primary/10 text-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
                  : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 rounded-3xl border border-border/80 bg-secondary/40 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Progress
          </p>
          <p className="mt-2 text-sm text-foreground">
            Packing is {packingPercent}% complete
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Budget Booked
          </p>
          <p className="mt-2 text-sm text-foreground">{formatCurrency(totalBooked)}</p>
        </div>
      </div>
    </aside>
  );
}
