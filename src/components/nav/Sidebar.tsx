"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar as SidebarShell,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const { collapsed, toggleSidebar } = useSidebar();
  const bookedLabel = formatBookedAmount(totalBooked, collapsed);

  return (
    <SidebarShell>
      <SidebarHeader className={cn(collapsed ? "px-3 pt-5" : "px-5 pt-5")}>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
          className={cn(
            "block w-full rounded-[1.25rem] text-left outline-none transition-all duration-300 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-primary/30",
            collapsed ? "px-1 py-2 text-center" : "px-2 py-2"
          )}
        >
          <div
            className={cn(
              "space-y-2 transition-all duration-300",
              collapsed && "space-y-1 text-center"
            )}
          >
            <p className="text-xs uppercase tracking-[0.32em] text-primary/80">
              {collapsed ? "SW" : "SW Road Trip"}
            </p>
            <div>
              <h1 className={cn("font-bold tracking-tight", collapsed ? "text-lg" : "text-2xl")}>
                {collapsed ? "'26" : "Southwest '26"}
              </h1>
              {!collapsed ? (
                <p className="text-sm text-muted-foreground">{countdownLabel}</p>
              ) : null}
            </div>
          </div>
        </button>
      </SidebarHeader>

      <SidebarContent className={cn(collapsed ? "px-2 py-4" : "px-4 py-4")}>
        <TooltipProvider>
          <SidebarGroup>
            {primaryNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;

              const navLink = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-2xl border text-sm transition-[background-color,border-color,color,padding,transform] duration-200",
                    collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
                    isActive
                      ? "border-white/50 bg-white/52 text-foreground shadow-[0_14px_30px_rgba(120,126,182,0.10)]"
                      : "border-transparent bg-white/0 text-muted-foreground hover:border-white/35 hover:bg-white/28 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed ? (
                    <span className="truncate transition-opacity duration-200">
                      {item.label}
                    </span>
                  ) : null}
                </Link>
              );

              if (!collapsed) {
                return navLink;
              }

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger render={navLink} />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </SidebarGroup>
        </TooltipProvider>
      </SidebarContent>

      <SidebarFooter className={cn(collapsed ? "px-2" : "px-4")}>
        <div
          className={cn(
            "space-y-3 rounded-[1.75rem] border border-white/35 bg-white/26 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl",
            collapsed && "rounded-2xl p-3"
          )}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              {collapsed ? "Pack" : "Progress"}
            </p>
            <p className={cn("mt-2 text-sm text-foreground", collapsed && "text-center")}>
              {collapsed ? `${packingPercent}%` : `Packing is ${packingPercent}% complete`}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              {collapsed ? "Book" : "Amount Booked"}
            </p>
            <p className={cn("mt-2 text-sm text-foreground", collapsed && "text-center")}>
              {bookedLabel}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </SidebarShell>
  );
}

function formatBookedAmount(amount: number, compact: boolean) {
  if (!compact) {
    return formatCurrency(amount);
  }

  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }

  return formatCurrency(amount).replace(".00", "");
}
