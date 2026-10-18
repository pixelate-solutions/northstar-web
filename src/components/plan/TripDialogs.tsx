"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Field, inputClass, PillButton, Sheet } from "@/components/ns/overlay";
import { useTrip } from "@/components/trip/TripProvider";
import { api } from "@/lib/api-client";
import type { DayJson } from "@/lib/client-types";

export function EditDayDialog({ day, open, onClose }: { day: DayJson; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={`Day ${day.dayNumber}`}>
      <EditDayForm day={day} onClose={onClose} />
    </Sheet>
  );
}

function EditDayForm({ day, onClose }: { day: DayJson; onClose: () => void }) {
  const { updateDay, canEdit } = useTrip();
  const [title, setTitle] = useState(day.title);
  const [location, setLocation] = useState(day.location);
  const [sleep, setSleep] = useState(day.sleepLocation ?? "");
  const [notes, setNotes] = useState(day.notes ?? "");

  return (
    <form
      className="flex flex-col gap-4 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        void updateDay(day.date, { title, location, sleepLocation: sleep || null, notes: notes || null });
        onClose();
      }}
    >
      <Field label="Title">
        <input className={inputClass} value={title} readOnly={!canEdit} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Where">
        <input className={inputClass} value={location} readOnly={!canEdit} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <Field label="Sleeping at">
        <input className={inputClass} value={sleep} readOnly={!canEdit} onChange={(e) => setSleep(e.target.value)} />
      </Field>
      <Field label="Day notes">
        <textarea
          className={`${inputClass} h-auto min-h-[110px] resize-none py-3 leading-6`}
          value={notes}
          readOnly={!canEdit}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      {canEdit ? (
        <div className="flex justify-end gap-2 pt-1">
          <PillButton onClick={onClose}>Cancel</PillButton>
          <PillButton tone="ink" type="submit">Save</PillButton>
        </div>
      ) : null}
    </form>
  );
}

export function DatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Dates & days">
      <DatesForm onClose={onClose} />
    </Sheet>
  );
}

function DatesForm({ onClose }: { onClose: () => void }) {
  const { bundle, refresh } = useTrip();
  const router = useRouter();
  const [start, setStart] = useState(bundle.trip.startDate ?? bundle.days[0]?.date ?? "");
  const [count, setCount] = useState(String(bundle.days.length || 1));
  const [saving, setSaving] = useState(false);

  const total = Math.max(1, Math.min(60, Number(count) || 1));
  const removedDays = bundle.days.slice(total);
  const removedStops = removedDays.reduce((sum, day) => sum + day.events.length, 0);

  async function save() {
    setSaving(true);
    try {
      await api("/api/days", { method: "POST", body: { startDate: start, totalDays: total } });
      await refresh();
      router.push("/app");
      router.refresh();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change the dates.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Field label="First day">
        <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Number of days">
        <input type="number" min={1} max={60} className={inputClass} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      {removedDays.length ? (
        <div className="rounded-[12px] bg-[#FCEDEC] px-4 py-3 text-[14px] font-semibold text-stop">
          {removedStops
            ? `Removes days ${removedDays[0].dayNumber}–${removedDays.at(-1)!.dayNumber} and their ${removedStops} stop${removedStops === 1 ? "" : "s"}.`
            : `Removes days ${removedDays[0].dayNumber}–${removedDays.at(-1)!.dayNumber}.`}
        </div>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <PillButton onClick={onClose}>Cancel</PillButton>
        <PillButton tone={removedStops ? "danger" : "ink"} disabled={!start || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </PillButton>
      </div>
    </div>
  );
}

export function RenameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Rename trip">
      <RenameForm onClose={onClose} />
    </Sheet>
  );
}

function RenameForm({ onClose }: { onClose: () => void }) {
  const { bundle, refresh } = useTrip();
  const [name, setName] = useState(bundle.trip.name);
  return (
    <form
      className="flex flex-col gap-4 pt-2"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api(`/api/trips/${bundle.trip.id}`, { method: "PATCH", body: { name: name.trim() } });
          await refresh();
          onClose();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Couldn't rename the trip.");
        }
      }}
    >
      <input autoFocus className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <div className="flex justify-end gap-2">
        <PillButton onClick={onClose}>Cancel</PillButton>
        <PillButton tone="ink" type="submit" disabled={!name.trim()}>Save</PillButton>
      </div>
    </form>
  );
}

export function DeleteTripDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bundle } = useTrip();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const stops = bundle.days.reduce((sum, day) => sum + day.events.length, 0);
  return (
    <Sheet open={open} onClose={onClose} title="Delete trip?">
      <div className="flex flex-col gap-4 pt-2">
        <p className="text-[15px] font-medium">
          {bundle.trip.name} and its {bundle.days.length} days and {stops} stops will be permanently deleted.
        </p>
        <div className="flex justify-end gap-2">
          <PillButton onClick={onClose}>Cancel</PillButton>
          <PillButton
            tone="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/trips/${bundle.trip.id}`, { method: "DELETE" });
                onClose();
                router.push("/app");
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Couldn't delete the trip.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={14} /> Delete
          </PillButton>
        </div>
      </div>
    </Sheet>
  );
}

interface Member {
  membershipId: number | null;
  userId: number;
  email: string | null;
  fullName: string | null;
  role: "owner" | "collaborator" | "viewer";
  isOwner: boolean;
}

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bundle } = useTrip();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"collaborator" | "viewer">("collaborator");
  const [busy, setBusy] = useState(false);
  const tripId = bundle.trip.id;

  useEffect(() => {
    if (!open) return;
    api<Member[]>(`/api/trips/${tripId}/members`)
      .then(setMembers)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Couldn't load people."));
  }, [open, tripId]);

  return (
    <Sheet open={open} onClose={onClose} title="Share" wide>
      <div className="flex flex-col gap-5 pt-2">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              const result = await api<{ members: Member[] }>(`/api/trips/${tripId}/members`, {
                method: "POST",
                body: { email: email.trim(), role },
              });
              setMembers(result.members);
              setEmail("");
              toast.success("Added");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Couldn't add them.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            type="email"
            required
            placeholder="Email"
            className={`${inputClass} flex-1`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "collaborator" | "viewer")}
              className="h-12 rounded-[12px] bg-surface px-3 text-[15px] font-semibold"
            >
              <option value="collaborator">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <PillButton tone="ink" type="submit" disabled={busy} className="h-12 px-5">Add</PillButton>
          </div>
        </form>
        <div className="flex flex-col">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-go text-[13px] font-bold text-white">
                {(member.fullName ?? member.email ?? "?")[0]?.toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{member.fullName ?? member.email}</span>
                {member.fullName && member.email ? <span className="truncate text-[13px] text-muted">{member.email}</span> : null}
              </span>
              {member.isOwner ? (
                <span className="text-[13px] font-semibold text-muted">Owner</span>
              ) : (
                <>
                  <select
                    value={member.role}
                    onChange={async (e) => {
                      const nextRole = e.target.value;
                      try {
                        await api(`/api/trips/${tripId}/members/${member.membershipId}`, { method: "PATCH", body: { role: nextRole } });
                        setMembers((list) => list.map((m) => (m.userId === member.userId ? { ...m, role: nextRole as Member["role"] } : m)));
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Couldn't change access.");
                      }
                    }}
                    className="rounded-[8px] bg-surface px-2 py-1.5 text-[13px] font-semibold"
                  >
                    <option value="collaborator">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={async () => {
                      try {
                        await api(`/api/trips/${tripId}/members/${member.membershipId}`, { method: "DELETE" });
                        setMembers((list) => list.filter((m) => m.userId !== member.userId));
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Couldn't remove them.");
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface"
                  >
                    <X size={15} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
