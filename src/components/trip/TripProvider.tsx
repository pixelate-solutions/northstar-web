"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { api, setCurrentTripId } from "@/lib/api-client";
import type {
  DayJson,
  EventJson,
  ExpenseJson,
  PackingJson,
  ReminderJson,
  TripBundle,
  TripSummary,
  Viewer,
} from "@/lib/client-types";

export type EventInput = Partial<
  Pick<
    EventJson,
    "title" | "startTime" | "endTime" | "category" | "description" | "location" | "lat" | "lng" | "tip" | "cost" | "isBooked" | "dayId"
  >
>;

interface AskState {
  open: boolean;
  draft: string | null;
  autoSend: boolean;
}

interface TripStore {
  bundle: TripBundle;
  trips: TripSummary[];
  viewer: Viewer;
  canEdit: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
  switchTrip: (tripId: number) => Promise<void>;
  addEvent: (dayId: number, input: EventInput) => Promise<EventJson | null>;
  updateEvent: (eventId: number, patch: EventInput) => Promise<void>;
  deleteEvent: (eventId: number) => Promise<void>;
  reorderEvents: (dayId: number, orderedIds: number[]) => Promise<void>;
  updateDay: (date: string, patch: Partial<Pick<DayJson, "title" | "location" | "sleepLocation" | "driveInfo" | "notes">>) => Promise<void>;
  addPacking: (input: { name: string; category: string; quantity?: number }) => Promise<void>;
  updatePacking: (id: number, patch: Partial<Pick<PackingJson, "name" | "category" | "quantity" | "isPacked" | "isEssential" | "notes">>) => Promise<void>;
  deletePacking: (id: number) => Promise<void>;
  addReminder: (input: { title: string; dueDate?: string | null; dayId?: number | null }) => Promise<void>;
  updateReminder: (id: number, patch: Partial<Pick<ReminderJson, "title" | "dueDate" | "isDone" | "body" | "dayId">>) => Promise<void>;
  deleteReminder: (id: number) => Promise<void>;
  addExpense: (input: { description: string; amount: number; category: string; isPaid?: boolean }) => Promise<void>;
  updateExpense: (id: number, patch: Partial<Pick<ExpenseJson, "description" | "category" | "isPaid" | "isBooked" | "notes" | "purchaseDate">> & { amount?: number }) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  ask: AskState;
  openAsk: (draft?: string, autoSend?: boolean) => void;
  closeAsk: () => void;
  highlightedEventIds: Set<number>;
  setHighlightedEventIds: (ids: Set<number>) => void;
  askConversationId: number | null;
  setAskConversationId: (id: number | null) => void;
}

const TripContext = createContext<TripStore | null>(null);

export function useTrip() {
  const store = useContext(TripContext);
  if (!store) throw new Error("useTrip must be used inside TripProvider");
  return store;
}

function sortEvents(events: EventJson[]) {
  return [...events].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.id - b.id
  );
}

function mapDays(bundle: TripBundle, fn: (day: DayJson) => DayJson): TripBundle {
  return { ...bundle, days: bundle.days.map(fn) };
}

let tempId = -1;

export function TripProvider({
  initialBundle,
  trips: initialTrips,
  viewer,
  children,
}: {
  initialBundle: TripBundle;
  trips: TripSummary[];
  viewer: Viewer;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [bundle, setBundle] = useState(initialBundle);
  const [trips, setTrips] = useState(initialTrips);
  const [ask, setAsk] = useState<AskState>({ open: false, draft: null, autoSend: false });
  const [highlightedEventIds, setHighlightedEventIds] = useState<Set<number>>(new Set());
  // The open chat survives closing/reopening the panel.
  const [askConversationId, setAskConversationId] = useState<number | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);
  // Optimistic rows get negative ids until the server responds; edits made in that window wait for the real id.
  const pendingCreates = useRef(new Map<number, Promise<number | null>>());
  const resolveId = useCallback(async (id: number) => (id < 0 ? ((await pendingCreates.current.get(id)) ?? null) : id), []);
  const trackCreate = useCallback(<T extends { id: number }>(tempKey: number, promise: Promise<T | null>) => {
    pendingCreates.current.set(
      tempKey,
      promise.then((row) => row?.id ?? null)
    );
    return promise;
  }, []);

  // Server props change after router.refresh(); keep local state in sync when the trip changes underneath us.
  const [lastInitial, setLastInitial] = useState(initialBundle);
  if (initialBundle !== lastInitial) {
    setLastInitial(initialBundle);
    setBundle(initialBundle);
    setTrips(initialTrips);
    if (initialBundle.trip.id !== lastInitial.trip.id) setAskConversationId(null);
  }

  // Every request names this trip (see api-client), so a phone switching trips can't redirect our edits.
  useLayoutEffect(() => {
    setCurrentTripId(bundle.trip.id);
  }, [bundle.trip.id]);

  const canEdit = bundle.role !== "viewer";
  const isOwner = bundle.role === "owner";

  const refresh = useCallback(async () => {
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      try {
        const [next, me] = await Promise.all([
          api<TripBundle>("/api/trip"),
          api<{ trips: TripSummary[] }>("/api/me"),
        ]);
        setBundle(next);
        setTrips(me.trips);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't refresh the trip.");
      } finally {
        refreshing.current = null;
      }
    })();
    return refreshing.current;
  }, []);

  // Live updates: pick up collaborators' changes every few seconds while the tab is visible.
  const inFlightWrites = useRef(0);
  const serverVersion = useRef<{ tripId: number; version: string } | null>(null);
  useEffect(() => {
    const tripId = bundle.trip.id;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible" || inFlightWrites.current > 0) return;
      try {
        const latest = await api<{ tripId: number; version: string }>("/api/trip/version");
        if (latest.tripId !== tripId) return;
        const previous = serverVersion.current;
        serverVersion.current = { tripId, version: latest.version };
        if (!previous || previous.tripId !== tripId || previous.version === latest.version) return;
        const next = await api<TripBundle>("/api/trip");
        if (!stopped && next.trip.id === tripId && inFlightWrites.current === 0) setBundle(next);
      } catch {
        // Offline or signed out; try again on the next tick.
      }
    };
    const timer = window.setInterval(check, 4000);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [bundle.trip.id]);

  /** Runs an optimistic update; on failure shows the error and reloads the server truth. */
  const optimistic = useCallback(
    async <T,>(apply: (current: TripBundle) => TripBundle, request: () => Promise<T>, reconcile?: (result: T, current: TripBundle) => TripBundle) => {
      setBundle(apply);
      inFlightWrites.current += 1;
      try {
        const result = await request();
        if (reconcile) setBundle((current) => reconcile(result, current));
        return result;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That didn't save.");
        await refresh();
        return null;
      } finally {
        inFlightWrites.current -= 1;
      }
    },
    [refresh]
  );

  /** Optimistic edit of one row that may still be awaiting its real id. */
  const mutate = useCallback(
    async <T,>(
      id: number,
      apply: (current: TripBundle, rowId: number) => TripBundle,
      request: (rowId: number) => Promise<T>,
      reconcile?: (result: T, current: TripBundle) => TripBundle
    ) => {
      if (id >= 0) return optimistic((current) => apply(current, id), () => request(id), reconcile);
      setBundle((current) => apply(current, id));
      const realId = await resolveId(id);
      if (realId === null) return null;
      return optimistic((current) => apply(current, realId), () => request(realId), reconcile);
    },
    [optimistic, resolveId]
  );

  const switchTrip = useCallback(
    async (tripId: number) => {
      try {
        const next = await api<TripBundle>(`/api/trip?tripId=${tripId}`);
        setBundle(next);
        router.push("/app");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't open that trip.");
      }
    },
    [router]
  );

  const addEvent = useCallback(
    async (dayId: number, input: EventInput) => {
      const day = bundle.days.find((item) => item.id === dayId);
      if (!day) return null;
      const ordered = sortEvents(day.events);
      // Place timed stops chronologically; untimed stops go to the end.
      let index = ordered.length;
      if (input.startTime) {
        const found = ordered.findIndex((event) => event.startTime && event.startTime > input.startTime!);
        if (found >= 0) index = found;
      }
      const placeholder: EventJson = {
        id: tempId--,
        dayId,
        title: input.title ?? "New stop",
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        category: input.category ?? "other",
        description: input.description ?? null,
        location: input.location ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        tip: input.tip ?? null,
        cost: input.cost ?? null,
        isBooked: input.isBooked ?? false,
        sortOrder: index,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextOrder = [...ordered];
      nextOrder.splice(index, 0, placeholder);
      const withOrder = nextOrder.map((event, position) => ({ ...event, sortOrder: position }));

      const created = await trackCreate(placeholder.id, optimistic(
        (current) => mapDays(current, (d) => (d.id === dayId ? { ...d, events: withOrder } : d)),
        async () => {
          const row = await api<EventJson>("/api/events", {
            method: "POST",
            body: { ...input, dayId, sortOrder: index, category: input.category ?? "other" },
          });
          const items = withOrder.map((event) => ({ id: event.id === placeholder.id ? row.id : event.id, sortOrder: event.sortOrder ?? 0 }));
          if (items.some((item, position) => ordered[position]?.id !== item.id)) {
            await api("/api/events/reorder", { method: "PATCH", body: { items } });
          }
          return row;
        },
        (row, current) =>
          mapDays(current, (d) =>
            d.id === dayId
              ? { ...d, events: d.events.map((event) => (event.id === placeholder.id ? { ...row, ...event, id: row.id, sortOrder: index, createdAt: row.createdAt, updatedAt: row.updatedAt } : event)) }
              : d
          )
      ));
      return created;
    },
    [bundle.days, optimistic, trackCreate]
  );

  const updateEvent = useCallback(
    async (eventId: number, patch: EventInput) => {
      await mutate(
        eventId,
        (current, rowId) => {
          let moved: EventJson | null = null;
          const days = current.days.map((day) => {
            const events = day.events
              .map((event) => {
                if (event.id !== rowId) return event;
                const next = { ...event, ...patch } as EventJson;
                if (patch.dayId !== undefined && patch.dayId !== day.id) {
                  moved = next;
                  return null;
                }
                return next;
              })
              .filter((event): event is EventJson => Boolean(event));
            return { ...day, events };
          });
          const movedEvent = moved as EventJson | null;
          return {
            ...current,
            days: movedEvent
              ? days.map((day) =>
                  day.id === movedEvent.dayId ? { ...day, events: [...day.events, { ...movedEvent, sortOrder: day.events.length + 900 }] } : day
                )
              : days,
          };
        },
        (rowId) =>
          api<EventJson>(`/api/events/${rowId}`, {
            method: "PATCH",
            body: patch.dayId !== undefined ? { ...patch, sortOrder: 999 } : patch,
          }),
        (row, current) => mapDays(current, (day) => ({ ...day, events: day.events.map((event) => (event.id === row.id ? row : event)) }))
      );
    },
    [mutate]
  );

  const deleteEvent = useCallback(
    async (eventId: number) => {
      await mutate(
        eventId,
        (current, rowId) => mapDays(current, (day) => ({ ...day, events: day.events.filter((event) => event.id !== rowId) })),
        (rowId) => api(`/api/events/${rowId}`, { method: "DELETE" })
      );
    },
    [mutate]
  );

  const reorderEvents = useCallback(
    async (dayId: number, orderedIds: number[]) => {
      const items = orderedIds.map((id, sortOrder) => ({ id, sortOrder }));
      await optimistic(
        (current) =>
          mapDays(current, (day) =>
            day.id === dayId
              ? {
                  ...day,
                  events: day.events.map((event) => ({ ...event, sortOrder: orderedIds.indexOf(event.id) })),
                }
              : day
          ),
        () => api("/api/events/reorder", { method: "PATCH", body: { items } })
      );
    },
    [optimistic]
  );

  const updateDay = useCallback<TripStore["updateDay"]>(
    async (date, patch) => {
      await optimistic(
        (current) => mapDays(current, (day) => (day.date === date ? { ...day, ...patch } : day)),
        () => api(`/api/days/${date}`, { method: "PUT", body: patch })
      );
    },
    [optimistic]
  );

  const addPacking = useCallback<TripStore["addPacking"]>(
    async (input) => {
      const placeholder: PackingJson = {
        id: tempId--,
        tripId: bundle.trip.id,
        category: input.category,
        name: input.name,
        quantity: input.quantity ?? 1,
        isPacked: false,
        isEssential: false,
        daySpecific: null,
        notes: null,
      };
      await trackCreate(placeholder.id, optimistic(
        (current) => ({ ...current, packingItems: [...current.packingItems, placeholder] }),
        () => api<PackingJson>("/api/packing", { method: "POST", body: { ...input, quantity: input.quantity ?? 1 } }),
        (row, current) => ({ ...current, packingItems: current.packingItems.map((item) => (item.id === placeholder.id ? { ...row, ...item, id: row.id } : item)) })
      ));
    },
    [bundle.trip.id, optimistic, trackCreate]
  );

  const updatePacking = useCallback<TripStore["updatePacking"]>(
    async (id, patch) => {
      await mutate(
        id,
        (current, rowId) => ({ ...current, packingItems: current.packingItems.map((item) => (item.id === rowId ? { ...item, ...patch } : item)) }),
        (rowId) => api(`/api/packing/${rowId}`, { method: "PATCH", body: patch })
      );
    },
    [mutate]
  );

  const deletePacking = useCallback<TripStore["deletePacking"]>(
    async (id) => {
      await mutate(
        id,
        (current, rowId) => ({ ...current, packingItems: current.packingItems.filter((item) => item.id !== rowId) }),
        (rowId) => api(`/api/packing/${rowId}`, { method: "DELETE" })
      );
    },
    [mutate]
  );

  const addReminder = useCallback<TripStore["addReminder"]>(
    async (input) => {
      const placeholder: ReminderJson = {
        id: tempId--,
        tripId: bundle.trip.id,
        title: input.title,
        body: null,
        dueDate: input.dueDate ?? null,
        isDone: false,
        priority: "medium",
        dayId: input.dayId ?? null,
      };
      await trackCreate(placeholder.id, optimistic(
        (current) => ({ ...current, reminders: [...current.reminders, placeholder] }),
        () => api<ReminderJson>("/api/reminders", { method: "POST", body: { title: input.title, dueDate: input.dueDate ?? "", dayId: input.dayId ?? null } }),
        (row, current) => ({ ...current, reminders: current.reminders.map((item) => (item.id === placeholder.id ? { ...row, ...item, id: row.id } : item)) })
      ));
    },
    [bundle.trip.id, optimistic, trackCreate]
  );

  const updateReminder = useCallback<TripStore["updateReminder"]>(
    async (id, patch) => {
      await mutate(
        id,
        (current, rowId) => ({ ...current, reminders: current.reminders.map((item) => (item.id === rowId ? { ...item, ...patch } : item)) }),
        (rowId) => api(`/api/reminders/${rowId}`, { method: "PATCH", body: patch })
      );
    },
    [mutate]
  );

  const deleteReminder = useCallback<TripStore["deleteReminder"]>(
    async (id) => {
      await mutate(
        id,
        (current, rowId) => ({ ...current, reminders: current.reminders.filter((item) => item.id !== rowId) }),
        (rowId) => api(`/api/reminders/${rowId}`, { method: "DELETE" })
      );
    },
    [mutate]
  );

  const addExpense = useCallback<TripStore["addExpense"]>(
    async (input) => {
      const placeholder: ExpenseJson = {
        id: tempId--,
        tripId: bundle.trip.id,
        category: input.category,
        description: input.description,
        amount: String(input.amount),
        isBooked: false,
        isPaid: input.isPaid ?? false,
        purchaseDate: null,
        receiptUrl: null,
        notes: null,
      };
      await trackCreate(placeholder.id, optimistic(
        (current) => ({ ...current, expenses: [...current.expenses, placeholder] }),
        () => api<ExpenseJson>("/api/expenses", { method: "POST", body: { ...input, isPaid: input.isPaid ?? false } }),
        (row, current) => ({ ...current, expenses: current.expenses.map((item) => (item.id === placeholder.id ? { ...row, ...item, id: row.id } : item)) })
      ));
    },
    [bundle.trip.id, optimistic, trackCreate]
  );

  const updateExpense = useCallback<TripStore["updateExpense"]>(
    async (id, patch) => {
      await mutate(
        id,
        (current, rowId) => ({
          ...current,
          expenses: current.expenses.map((item) =>
            item.id === rowId ? { ...item, ...patch, amount: patch.amount !== undefined ? String(patch.amount) : item.amount } : item
          ),
        }),
        (rowId) => api(`/api/expenses/${rowId}`, { method: "PATCH", body: patch })
      );
    },
    [mutate]
  );

  const deleteExpense = useCallback<TripStore["deleteExpense"]>(
    async (id) => {
      await mutate(
        id,
        (current, rowId) => ({ ...current, expenses: current.expenses.filter((item) => item.id !== rowId) }),
        (rowId) => api(`/api/expenses/${rowId}`, { method: "DELETE" })
      );
    },
    [mutate]
  );

  const openAsk = useCallback((draft?: string, autoSend = false) => {
    setAsk({ open: true, draft: draft ?? null, autoSend });
  }, []);
  const closeAsk = useCallback(() => setAsk({ open: false, draft: null, autoSend: false }), []);

  const sortedBundle = useMemo<TripBundle>(
    () => ({ ...bundle, days: [...bundle.days].sort((a, b) => a.date.localeCompare(b.date)).map((day) => ({ ...day, events: sortEvents(day.events) })) }),
    [bundle]
  );

  const value = useMemo<TripStore>(
    () => ({
      bundle: sortedBundle,
      trips,
      viewer,
      canEdit,
      isOwner,
      refresh,
      switchTrip,
      addEvent,
      updateEvent,
      deleteEvent,
      reorderEvents,
      updateDay,
      addPacking,
      updatePacking,
      deletePacking,
      addReminder,
      updateReminder,
      deleteReminder,
      addExpense,
      updateExpense,
      deleteExpense,
      ask,
      openAsk,
      closeAsk,
      highlightedEventIds,
      setHighlightedEventIds,
      askConversationId,
      setAskConversationId,
    }),
    [sortedBundle, trips, viewer, canEdit, isOwner, refresh, switchTrip, addEvent, updateEvent, deleteEvent, reorderEvents, updateDay, addPacking, updatePacking, deletePacking, addReminder, updateReminder, deleteReminder, addExpense, updateExpense, deleteExpense, ask, openAsk, closeAsk, highlightedEventIds, askConversationId]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}
