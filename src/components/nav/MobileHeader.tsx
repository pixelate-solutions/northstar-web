"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, Plus } from "lucide-react";
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
import { primaryNavItems } from "@/lib/navigation";
import { product } from "@/lib/product";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  activeTripId: number;
  countdownLabel: string;
  daysHref: string;
  tripName: string;
  trips: Array<{ id: number; name: string }>;
}

export function MobileHeader({
  activeTripId,
  countdownLabel,
  daysHref,
  tripName,
  trips,
}: MobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingTrip, setSwitchingTrip] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingTrip, setCreatingTrip] = useState(false);

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

    setOpen(false);
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
    setOpen(false);
    toast.success("New trip created.");
    router.refresh();
  }

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

            <DropdownMenu>
              <DropdownMenuTrigger
                className="mt-4 w-full rounded-[1.25rem] border border-white/45 bg-white/70 px-4 py-3.5 text-left shadow-[0_12px_28px_rgba(18,43,74,0.08)] outline-none transition hover:bg-white/82 focus-visible:ring-2 focus-visible:ring-primary/30"
                disabled={switchingTrip || creatingTrip}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Active Trip
                    </p>
                    <p className="mt-1 truncate text-base font-semibold text-foreground">
                      {tripName}
                    </p>
                  </div>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                sideOffset={8}
                className="w-[min(22rem,calc(100vw-2rem))] rounded-[1.25rem] border border-white/60 bg-white/96 p-2 shadow-[0_22px_60px_rgba(17,46,72,0.14)] backdrop-blur-xl"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-3 py-2 text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                    Trips
                  </DropdownMenuLabel>
                  {trips.map((trip) => (
                    <DropdownMenuItem
                      key={trip.id}
                      onClick={() => handleTripChange(trip.id)}
                      className={cn(
                        "cursor-pointer rounded-[1rem] px-3 py-3 text-foreground hover:bg-slate-100/80 hover:text-foreground focus:bg-slate-100/80 focus:text-foreground",
                        trip.id === activeTripId && "bg-secondary/70 text-foreground"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[0.95rem] font-medium">{trip.name}</p>
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
                  className="cursor-pointer rounded-[1rem] px-3 py-3 text-foreground hover:bg-slate-100/80 hover:text-foreground focus:bg-slate-100/80 focus:text-foreground"
                >
                  <Plus className="size-4" />
                  <span>Add Trip</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {primaryNavItems.map((item) => {
              const href = item.href === "/app/days" ? daysHref : item.href;
              const isActive =
                pathname === item.href ||
                pathname === href ||
                (item.href !== "/app" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={href}
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
    </>
  );
}
