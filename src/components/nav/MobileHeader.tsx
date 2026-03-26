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
}

export function MobileHeader({ countdownLabel }: MobileHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/40 bg-white/72 px-4 shadow-[0_12px_40px_rgba(191,102,62,0.08)] backdrop-blur-xl lg:hidden">
      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-[0.28em] text-primary/80">SW Road Trip</p>
        <p className="text-sm font-semibold">{"Southwest '26"}</p>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="relative rounded-2xl border border-white/50 bg-white/46 p-2 shadow-[0_10px_24px_rgba(191,102,62,0.10)] backdrop-blur-xl">
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 overflow-y-auto border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,244,236,0.92))] px-0 py-0 backdrop-blur-2xl">
          <div className="border-b border-white/45 px-5 pb-5 pt-14">
            <p className="text-xs uppercase tracking-[0.32em] text-primary/80">SW Road Trip</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">{"Southwest '26"}</h2>
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
                      ? "border-white/50 bg-white/58 text-foreground shadow-[0_14px_30px_rgba(191,102,62,0.10)]"
                      : "border-transparent text-muted-foreground hover:border-white/35 hover:bg-white/34 hover:text-foreground"
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
