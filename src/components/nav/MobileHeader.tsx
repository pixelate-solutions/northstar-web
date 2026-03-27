"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { primaryNavItems } from "@/lib/navigation";
import { product } from "@/lib/product";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  countdownLabel: string;
  tripName: string;
}

export function MobileHeader({ countdownLabel, tripName }: MobileHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      document.body.style.removeProperty("overflow");
      return;
    }

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/40 bg-white/72 px-4 shadow-[0_12px_40px_rgba(18,43,74,0.08)] backdrop-blur-xl lg:hidden">
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
            {product.name}
          </p>
          <p className="text-sm font-semibold">{tripName}</p>
        </div>

        <button
          type="button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="relative rounded-2xl border border-white/50 bg-white/46 p-2 shadow-[0_10px_24px_rgba(18,43,74,0.10)] backdrop-blur-xl"
        >
          <Menu className="size-5" />
        </button>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/12 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto border-r border-white/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(238,245,247,0.94))] px-0 py-0 shadow-[0_22px_64px_rgba(28,31,46,0.18)] backdrop-blur-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="border-b border-white/45 px-5 pb-5 pt-14">
            <p className="text-xs uppercase tracking-[0.32em] text-primary/80">
              {product.name}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">{tripName}</h2>
            <p className="text-sm text-muted-foreground">{countdownLabel}</p>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {primaryNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/app" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                    isActive
                      ? "border-white/50 bg-white/58 text-foreground shadow-[0_14px_30px_rgba(18,43,74,0.10)]"
                      : "border-transparent text-muted-foreground hover:border-white/35 hover:bg-white/34 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
