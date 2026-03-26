"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { primaryNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  countdownLabel: string;
  totalBadge?: number;
}

export function MobileHeader({ countdownLabel, totalBadge = 0 }: MobileHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border/80 bg-card/95 px-4 backdrop-blur lg:hidden">
      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-[0.28em] text-primary/80">SW Road Trip</p>
        <p className="text-sm font-semibold">Southwest &apos;26</p>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="relative rounded-xl border border-border/70 bg-secondary/40 p-2">
          <Menu className="size-5" />
          {totalBadge > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
          ) : null}
        </SheetTrigger>
        <SheetContent side="left" className="w-72 overflow-y-auto bg-card px-0 py-0">
          <div className="border-b border-border/70 px-5 pb-5 pt-14">
            <p className="text-xs uppercase tracking-[0.32em] text-primary/80">SW Road Trip</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Southwest &apos;26</h2>
            <p className="text-sm text-muted-foreground">{countdownLabel}</p>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {primaryNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-foreground shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
