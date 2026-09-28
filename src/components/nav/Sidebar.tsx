"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ChevronDown, Download, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { downloadTripExport } from "@/components/trips/exportTrip";
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
import { useCurrentTimeZone } from "@/hooks/useCurrentTimeZone";
import { primaryNavItems } from "@/lib/navigation";
import { product } from "@/lib/product";
import { getCountdownLabel } from "@/lib/trip-data";
import { cn, formatCurrency } from "@/lib/utils";

interface SidebarProps {
  activeTripId: number;
  activeTripRole: "owner" | "collaborator" | "viewer";
  canEditActiveTrip: boolean;
  canManageTripUsers: boolean;
  countdownLabel: string;
  daysHref: string;
  packingPercent: number;
  totalBooked: number;
  tripDates: string[];
  tripName: string;
  trips: Array<{ id: number; name: string; accessRole: "owner" | "collaborator" | "viewer" }>;
}

export function Sidebar({
  activeTripId,
  activeTripRole,
  canEditActiveTrip,
  canManageTripUsers,
  countdownLabel,
  daysHref,
  packingPercent,
  totalBooked,
  tripDates,
  tripName,
  trips,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggleSidebar } = useSidebar();
  const timeZone = useCurrentTimeZone();
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
  const [exportingTrip, setExportingTrip] = useState(false);
  const bookedLabel = formatBookedAmount(totalBooked, collapsed);
  const resolvedCountdownLabel = timeZone
    ? getCountdownLabel(tripDates, new Date(), { timeZone })
    : countdownLabel;
  const clerkReady = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const defaultTripName = `New Trip ${trips.length + 1}`;

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
    toast.success("Trip deleted.");
    router.refresh();
  }

  async function handleExportTrip() {
    if (exportingTrip) return;
    setExportingTrip(true);
    try {
      await downloadTripExport();
    } catch {
      toast.error("Unable to export trip.");
    } finally {
      setExportingTrip(false);
    }
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
          <div className="mt-3 flex items-stretch gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="min-w-0 flex-1 rounded-[1.25rem] border border-white/40 bg-white/32 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl outline-none transition hover:bg-white/42 focus-visible:ring-2 focus-visible:ring-primary/30"
                disabled={switchingTrip || creatingTrip || renamingTrip}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{tripName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {resolvedCountdownLabel} · {activeTripRole}
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
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[0.95rem] font-medium sm:text-sm">{trip.name}</p>
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
                <DropdownMenuSeparator />
                {canManageTripUsers ? (
                  <DropdownMenuItem
                    onClick={() => setSharingDialogOpen(true)}
                    className="cursor-pointer rounded-[1rem] px-3 py-3 text-foreground hover:bg-slate-100/80 hover:text-foreground focus:bg-slate-100/80 focus:text-foreground sm:rounded-[0.9rem] sm:px-2.5 sm:py-2.5"
                  >
                    <Users className="size-4" />
                    <span>Manage Sharing</span>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={handleExportTrip}
                  disabled={exportingTrip}
                  className="cursor-pointer rounded-[1rem] px-3 py-3 text-foreground hover:bg-slate-100/80 hover:text-foreground focus:bg-slate-100/80 focus:text-foreground sm:rounded-[0.9rem] sm:px-2.5 sm:py-2.5"
                >
                  <Download className="size-4" />
                  <span>{exportingTrip ? "Exporting..." : "Export Trip (HTML)"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCreateDialogOpen(true)}
                  className="cursor-pointer rounded-[1rem] px-3 py-3 text-foreground hover:bg-slate-100/80 hover:text-foreground focus:bg-slate-100/80 focus:text-foreground sm:rounded-[0.9rem] sm:px-2.5 sm:py-2.5"
                >
                  <Plus className="size-4" />
                  <span>Add Trip</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={handleExportTrip}
              disabled={exportingTrip}
              className="inline-flex shrink-0 items-center justify-center rounded-[1.25rem] border border-white/40 bg-white/32 px-3 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl transition hover:bg-white/42 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
              aria-label="Export trip as HTML"
              title="Export trip as HTML"
            >
              {exportingTrip ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            </button>

            {canEditActiveTrip ? (
              <button
                type="button"
                onClick={() => setRenameDialogOpen(true)}
                className="inline-flex shrink-0 items-center justify-center rounded-[1.25rem] border border-white/40 bg-white/32 px-3 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-xl transition hover:bg-white/42 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Rename active trip"
              >
                <Pencil className="size-4" />
              </button>
            ) : null}
          </div>
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
            <UserButton
              showName
              appearance={{
                elements: {
                  userButtonTrigger:
                    "flex w-full items-center justify-between rounded-[1.15rem] border border-white/40 bg-white/60 px-3 py-2 outline-none transition hover:bg-white/72 focus-visible:ring-2 focus-visible:ring-primary/30",
                  userButtonBox:
                    "flex w-full flex-row-reverse items-center justify-between gap-3",
                  userButtonOuterIdentifier: "text-left",
                  userButtonInnerIdentifier: "text-sm font-medium text-foreground",
                  userButtonAvatarBox: "size-8 ring-1 ring-primary/10",
                },
              }}
            />
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
