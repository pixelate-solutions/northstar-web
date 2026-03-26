"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { mobileNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  unpackedCount: number;
  overdueCount: number;
  unpaidCount: number;
}

export function MobileNav({
  unpackedCount,
  overdueCount,
  unpaidCount,
}: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 px-2 py-2 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          let badgeCount = 0;
          if (item.href === "/packing") badgeCount = unpackedCount;
          if (item.href === "/reminders") badgeCount = overdueCount + unpaidCount;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] transition",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/70"
              )}
            >
              <Icon className="mb-1 size-4" />
              <span>{item.label}</span>
              {badgeCount > 0 ? (
                <span className="absolute right-3 top-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
