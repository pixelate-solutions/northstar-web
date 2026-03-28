"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type TripMemberSummary = {
  membershipId: number | null;
  userId: number;
  email: string | null;
  fullName: string | null;
  role: "owner" | "viewer" | "collaborator";
  isOwner: boolean;
};

export function TripSharingDialog({
  open,
  onOpenChange,
  tripId,
  tripName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  tripName: string;
}) {
  const [members, setMembers] = useState<TripMemberSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "collaborator">("viewer");
  const [isInviting, setIsInviting] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/members`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | TripMemberSummary[]
        | { error?: string }
        | null;

      if (!response.ok || !Array.isArray(data)) {
        toast.error(
          !Array.isArray(data) && data?.error ? data.error : "Unable to load trip members."
        );
        return;
      }

      setMembers(data);
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (!open) {
      setInviteEmail("");
      setInviteRole("viewer");
      return;
    }

    void loadMembers();
  }, [loadMembers, open]);

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Email is required.");
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          role: inviteRole,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { members?: TripMemberSummary[]; error?: string }
        | null;

      if (!response.ok) {
        toast.error(data?.error ?? "Unable to share this trip.");
        return;
      }

      setMembers(data?.members ?? []);
      setInviteEmail("");
      setInviteRole("viewer");
      toast.success("Trip access updated.");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRoleChange(memberId: number, role: "viewer" | "collaborator") {
    setBusyMemberId(memberId);
    try {
      const response = await fetch(`/api/trips/${tripId}/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error ?? "Unable to update trip member.");
        return;
      }

      setMembers((current) =>
        current.map((member) =>
          member.membershipId === memberId
            ? {
                ...member,
                role,
              }
            : member
        )
      );
      toast.success("Trip access updated.");
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleRemove(memberId: number) {
    setBusyMemberId(memberId);
    try {
      const response = await fetch(`/api/trips/${tripId}/members/${memberId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(data?.error ?? "Unable to remove trip member.");
        return;
      }

      setMembers((current) => current.filter((member) => member.membershipId !== memberId));
      toast.success("Trip member removed.");
    } finally {
      setBusyMemberId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[min(42rem,calc(100vw-2rem))] overflow-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4" />
            Share {tripName}
          </DialogTitle>
          <DialogDescription className="break-words leading-6">
            Owners can invite viewers or collaborators. Viewers can only view the trip. Collaborators can edit the trip. Only the owner can manage trip users.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-4">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Add User
            </p>
            <div className="mt-3 space-y-3">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={isInviting}
              />
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,10rem)_auto] sm:justify-end">
                <select
                  className="h-8 min-w-0 rounded-lg border border-input bg-input/30 px-2.5 text-sm"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as "viewer" | "collaborator")
                  }
                  disabled={isInviting}
                >
                  <option value="viewer">Viewer</option>
                  <option value="collaborator">Collaborator</option>
                </select>
                <Button onClick={() => void handleInvite()} disabled={isInviting}>
                  {isInviting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Add User
                </Button>
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Trip Access
            </p>
            <div className="mt-3 space-y-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading trip members
                </div>
              ) : members.length ? (
                members.map((member) => {
                  const isBusy = member.membershipId !== null && busyMemberId === member.membershipId;
                  return (
                    <div
                      key={member.membershipId ?? `owner-${member.userId}`}
                      className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border/60 bg-white/70 p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {member.fullName || member.email || "Unnamed user"}
                          </p>
                          <Badge className="bg-slate-100 text-slate-700">{member.role}</Badge>
                        </div>
                        {member.email ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">{member.email}</p>
                        ) : null}
                      </div>

                      {member.isOwner ? (
                        <p className="text-xs text-muted-foreground sm:shrink-0">Owner access</p>
                      ) : (
                        <div className="flex min-w-0 flex-col gap-2 sm:min-w-[13rem] sm:flex-row sm:items-center sm:justify-end">
                          <select
                            className="h-8 min-w-0 rounded-lg border border-input bg-input/30 px-2.5 text-sm"
                            value={member.role}
                            onChange={(event) =>
                              void handleRoleChange(
                                member.membershipId!,
                                event.target.value as "viewer" | "collaborator"
                              )
                            }
                            disabled={isBusy}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="collaborator">Collaborator</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-500 hover:text-red-600"
                            onClick={() => void handleRemove(member.membershipId!)}
                            disabled={isBusy}
                            title="Remove user"
                          >
                            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-4 text-sm text-muted-foreground">
                  No shared users on this trip yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
