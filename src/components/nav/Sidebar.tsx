"use client";

import Link from "next/link";
import Image from "next/image";
import { useClerk, useUser } from "@clerk/nextjs";
import { ChevronDown, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { product } from "@/lib/product";
import { cn, formatCurrency } from "@/lib/utils";

interface SidebarProps {
  activeTripId: number;
  countdownLabel: string;
  daysHref: string;
  packingPercent: number;
  totalBooked: number;
  tripName: string;
  trips: Array<{ id: number; name: string }>;
}

export function Sidebar({
  activeTripId,
  countdownLabel,
  daysHref,
  packingPercent,
  totalBooked,
  tripName,
  trips,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { openUserProfile } = useClerk();
  const { user } = useUser();
  const { collapsed, toggleSidebar } = useSidebar();
  const [switchingTrip, setSwitchingTrip] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const bookedLabel = formatBookedAmount(totalBooked, collapsed);
  const clerkReady = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  async function handleTripChange(nextTripId: number) {
    setSwitchingTrip(true);
    const response = await fetch("/api/trips/select", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tripId: nextTripId }),
    });

    setSwitchingTrip(false);

    if (!response.ok) {
      toast.error("Unable to switch trips.");
      return;
    }

    router.refresh();
  }

  async function handleCreateTrip() {
    setCreatingTrip(true);
    const response = await fetch("/api/trips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `New Trip ${trips.length + 1}`,
        totalDays: 7,
        importTemplate: false,
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setCreatingTrip(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to create a new trip.");
      return;
    }

    setCreateDialogOpen(false);
    toast.success("New trip created.");
    router.refresh();
  }

  return (
    <SidebarShell>
      <SidebarHeader className={cn(collapsed ? "px-3 pt-5" : "px-5 pt-5")}>
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
          className={cn(
            "block w-full rounded-[1.1rem] text-left outline-none transition-all duration-300 hover:bg-white/24 focus-visible:ring-2 focus-visible:ring-primary/30",
            collapsed ? "px-1 py-2 text-center" : "px-3 py-2.5"
          )}
        >
          <p className="text-xs uppercase tracking-[0.34em] text-primary/80">
            {collapsed ? "NS" : product.name}
          </p>
        </button>

        {!collapsed ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="mt-3 w-full rounded-[1.25rem] border border-white/40 bg-white/32 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl outline-none transition hover:bg-white/42 focus-visible:ring-2 focus-visible:ring-primary/30"
              disabled={switchingTrip || creatingTrip}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{tripName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {countdownLabel}
                  </p>
                </div>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              sideOffset={8}
              className="w-[min(22rem,calc(100vw-2rem))] rounded-[1.25rem] border border-white/60 bg-white/96 p-2 shadow-[0_22px_60px_rgba(17,46,72,0.14)] backdrop-blur-xl sm:w-[var(--anchor-width)] sm:rounded-[1.1rem] sm:p-1.5"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-3 py-2 text-[11px] uppercase tracking-[0.26em] text-muted-foreground sm:px-2 sm:py-1.5">
                  Trips
                </DropdownMenuLabel>
                {trips.map((trip) => (
                  <DropdownMenuItem
                    key={trip.id}
                    onClick={() => handleTripChange(trip.id)}
                    className={cn(
                      "cursor-pointer rounded-[1rem] px-3 py-3 text-foreground hover:bg-slate-100/80 hover:text-foreground focus:bg-slate-100/80 focus:text-foreground sm:rounded-[0.9rem] sm:px-2.5 sm:py-2.5",
                      trip.id === activeTripId && "bg-secondary/70 text-foreground"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.95rem] font-medium sm:text-sm">{trip.name}</p>
                      {trip.id === activeTripId ? (
                        <p className="text-xs text-muted-foreground">Current trip</p>
                      ) : null}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCreateDialogOpen(true)}
                className="cursor-pointer rounded-[1rem] px-3 py-3 text-foreground hover:bg-slate-100/80 hover:text-foreground focus:bg-slate-100/80 focus:text-foreground sm:rounded-[0.9rem] sm:px-2.5 sm:py-2.5"
              >
                <Plus className="size-4" />
                <span>Add Trip</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </SidebarHeader>

      <SidebarContent className={cn(collapsed ? "px-2 py-4" : "px-4 py-4")}>
        <TooltipProvider>
          <SidebarGroup>
            {primaryNavItems.map((item) => {
              const href = item.href === "/app/days" ? daysHref : item.href;
              const isActive =
                pathname === item.href ||
                pathname === href ||
                (item.href !== "/app" && pathname.startsWith(item.href));
              const Icon = item.icon;

              const navLink = (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "flex items-center rounded-2xl border text-sm transition-[background-color,border-color,color,padding,transform] duration-200",
                    collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
                    isActive
                      ? "border-white/50 bg-white/52 text-foreground shadow-[0_14px_30px_rgba(18,43,74,0.10)]"
                      : "border-transparent bg-white/0 text-muted-foreground hover:border-white/35 hover:bg-white/28 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
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
              {collapsed ? "Book" : "Booked"}
            </p>
            <p className={cn("mt-2 text-sm text-foreground", collapsed && "text-center")}>
              {bookedLabel}
            </p>
          </div>
          {!collapsed && clerkReady ? (
            <button
              type="button"
              onClick={() => openUserProfile()}
              className="flex w-full items-center justify-between rounded-[1.15rem] border border-white/40 bg-white/60 px-3 py-2 outline-none transition hover:bg-white/72 focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Account
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">Manage profile</p>
              </div>
              <div className="relative size-8 overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/10">
                {user?.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt={user.fullName ?? user.username ?? "Profile image"}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs font-semibold text-primary">
                    {getInitials(user?.fullName ?? user?.username ?? "Me")}
                  </div>
                )}
              </div>
            </button>
          ) : null}
        </div>
      </SidebarFooter>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md rounded-[1.6rem] border border-slate-200 bg-white p-0 text-foreground shadow-[0_30px_90px_rgba(17,46,72,0.18)]"
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Create a new trip?
            </DialogTitle>
            <DialogDescription className="leading-7">
              This will create a blank 7-day trip and switch your active workspace to it.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col-reverse gap-2 rounded-b-[1.6rem] border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creatingTrip}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateTrip} disabled={creatingTrip}>
              {creatingTrip ? "Creating..." : "Create Trip"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
