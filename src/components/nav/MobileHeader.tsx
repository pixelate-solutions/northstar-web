"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { TripSharingDialog } from "@/components/trips/TripSharingDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { useCurrentTimeZone } from "@/hooks/useCurrentTimeZone";
import { primaryNavItems } from "@/lib/navigation";
import { product } from "@/lib/product";
import { getCountdownLabel } from "@/lib/trip-data";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  activeTripId: number;
  activeTripRole: "owner" | "collaborator" | "viewer";
  canEditActiveTrip: boolean;
  canManageTripUsers: boolean;
  countdownLabel: string;
  daysHref: string;
  tripDates: string[];
  tripName: string;
  trips: Array<{ id: number; name: string; accessRole: "owner" | "collaborator" | "viewer" }>;
}

export function MobileHeader({
  activeTripId,
  activeTripRole,
  canEditActiveTrip,
  canManageTripUsers,
  countdownLabel,
  daysHref,
  tripDates,
  tripName,
  trips,
}: MobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const timeZone = useCurrentTimeZone();
  const [open, setOpen] = useState(false);
  const [switchingTrip, setSwitchingTrip] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTripName, setCreateTripName] = useState("");
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sharingDialogOpen, setSharingDialogOpen] = useState(false);
  const [tripPendingDelete, setTripPendingDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deletingTripId, setDeletingTripId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState(tripName);
  const [renamingTrip, setRenamingTrip] = useState(false);
  const resolvedCountdownLabel = timeZone
    ? getCountdownLabel(tripDates, new Date(), { timeZone })
    : countdownLabel;
  const defaultTripName = `New Trip ${trips.length + 1}`;

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

  useEffect(() => {
    setRenameValue(tripName);
  }, [tripName]);

  useEffect(() => {
    if (!createDialogOpen) {
      setCreateTripName("");
    }
  }, [createDialogOpen]);

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
        name: createTripName.trim() || defaultTripName,
        totalDays: 7,
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

  async function handleRenameTrip() {
    const nextName = renameValue.trim();
    if (!nextName) {
      toast.error("Trip name is required.");
      return;
    }

    setRenamingTrip(true);
    const response = await fetch(`/api/trips/${activeTripId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: nextName }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setRenamingTrip(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to rename trip.");
      return;
    }

    setRenameDialogOpen(false);
    toast.success("Trip renamed.");
    router.refresh();
  }

  async function handleDeleteTrip() {
    if (!tripPendingDelete || deletingTripId === tripPendingDelete.id) {
      return;
    }

    setDeletingTripId(tripPendingDelete.id);
    const response = await fetch(`/api/trips/${tripPendingDelete.id}`, {
      method: "DELETE",
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setDeletingTripId(null);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to delete trip.");
      return;
    }

    setTripPendingDelete(null);
    setOpen(false);
    toast.success("Trip deleted.");
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
            <p className="text-sm text-muted-foreground">
              {resolvedCountdownLabel} · {activeTripRole}
            </p>

            <div className="mt-4 flex items-stretch gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="min-w-0 flex-1 rounded-[1.25rem] border border-white/45 bg-white/70 px-4 py-3.5 text-left shadow-[0_12px_28px_rgba(18,43,74,0.08)] outline-none transition hover:bg-white/82 focus-visible:ring-2 focus-visible:ring-primary/30"
                  disabled={switchingTrip || creatingTrip || renamingTrip}
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
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[0.95rem] font-medium">{trip.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {trip.id === activeTripId ? "Current trip" : trip.accessRole}
                            </p>
                          </div>
                          {trip.accessRole === "owner" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 text-slate-500 hover:text-red-600"
                              title={`Delete ${trip.name}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setTripPendingDelete({ id: trip.id, name: trip.name });
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  {canManageTripUsers ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setSharingDialogOpen(true)}
                        className="cursor-pointer rounded-[1rem] px-3 py-3 text-foreground hover:bg-slate-100/80 hover:text-foreground focus:bg-slate-100/80 focus:text-foreground"
                      >
                        <Users className="size-4" />
                        <span>Manage Sharing</span>
                      </DropdownMenuItem>
                    </>
                  ) : null}
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

              {canEditActiveTrip ? (
                <button
                  type="button"
                  onClick={() => setRenameDialogOpen(true)}
                  className="inline-flex shrink-0 items-center justify-center rounded-[1.25rem] border border-white/45 bg-white/70 px-4 text-muted-foreground shadow-[0_12px_28px_rgba(18,43,74,0.08)] transition hover:bg-white/82 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label="Rename active trip"
                >
                  <Pencil className="size-4" />
                </button>
              ) : null}
            </div>
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
          <div className="px-6 pt-5">
            <Input
              value={createTripName}
              onChange={(event) => setCreateTripName(event.target.value)}
              placeholder={defaultTripName}
              maxLength={80}
              autoFocus
            />
          </div>
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

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md rounded-[1.6rem] border border-slate-200 bg-white p-0 text-foreground shadow-[0_30px_90px_rgba(17,46,72,0.18)]"
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Rename trip
            </DialogTitle>
            <DialogDescription className="leading-7">
              Update the name shown across your workspace and trip switcher.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pt-5">
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Trip name"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 rounded-b-[1.6rem] border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false);
                setRenameValue(tripName);
              }}
              disabled={renamingTrip}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleRenameTrip} disabled={renamingTrip}>
              {renamingTrip ? "Saving..." : "Save Name"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(tripPendingDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && deletingTripId === null) {
            setTripPendingDelete(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete trip?</DialogTitle>
            <DialogDescription>
              {tripPendingDelete
                ? `This will permanently delete "${tripPendingDelete.name}" and all of its trip data.`
                : "This will permanently delete this trip and all of its data."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTripPendingDelete(null)}
              disabled={deletingTripId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteTrip()}
              disabled={deletingTripId !== null}
            >
              {deletingTripId !== null ? "Deleting..." : "Delete Trip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canManageTripUsers ? (
        <TripSharingDialog
          open={sharingDialogOpen}
          onOpenChange={setSharingDialogOpen}
          tripId={activeTripId}
          tripName={tripName}
        />
      ) : null}
    </>
  );
}
