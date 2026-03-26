"use client";

import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { EventCard } from "@/components/schedule/EventCard";
import { EventModal } from "@/components/schedule/EventModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Event } from "@/db/schema";
import { timeToMinutes } from "@/lib/utils";

function sortEventsByTime(items: Event[]) {
  return [...items].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) return startDiff;

    const endDiff = timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
    if (endDiff !== 0) return endDiff;

    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

function SortableEvent({
  event,
  date,
  sortable,
  onOpen,
  onEdit,
  onDelete,
}: {
  event: Event;
  date: string;
  sortable: boolean;
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: event.id,
    disabled: !sortable,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <EventCard
        event={event}
        date={date}
        sortable={sortable}
        onOpen={onOpen}
        dragHandleProps={{
          ...attributes,
          ...listeners,
        }}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

interface DayScheduleProps {
  dayId: number;
  date: string;
  events: Event[];
  sortable?: boolean;
  editable?: boolean;
  showAddButton?: boolean;
  title?: string;
}

export function DaySchedule({
  dayId,
  date,
  events,
  sortable = false,
  editable = true,
  showAddButton = true,
  title = "Day Timeline",
}: DayScheduleProps) {
  const router = useRouter();
  const [items, setItems] = useState(sortEventsByTime(events));
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  useEffect(() => {
    setItems(sortEventsByTime(events));
  }, [events]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const nextSortOrder = useMemo(
    () => Math.max(...items.map((item) => item.sortOrder ?? 0), 0) + 1,
    [items]
  );

  async function removeEvent(event: Event) {
    const response = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Unable to delete event.");
      return;
    }

    toast.success("Event deleted.");
    setEventToDelete(null);
    router.refresh();
  }

  async function persistOrder(nextItems: Event[]) {
    const response = await fetch("/api/events/reorder", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: nextItems.map((item, index) => ({
          id: item.id,
          sortOrder: index + 1,
        })),
      }),
    });

    if (!response.ok) {
      toast.error("Unable to reorder events.");
      router.refresh();
      return;
    }

    toast.success("Schedule reordered.");
    router.refresh();
  }

  if (!items.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          {editable && showAddButton ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Add Event
            </Button>
          ) : null}
        </div>
        <EmptyState
          title="No events scheduled yet"
          description={
            editable
              ? "Add the first event for this day to start building the timeline."
              : "No events have been scheduled for this day yet."
          }
          actionLabel={editable && showAddButton ? "Add Event" : undefined}
          onAction={editable && showAddButton ? () => setModalOpen(true) : undefined}
        />
        {editable ? (
          <EventModal
            dayId={dayId}
            date={date}
            open={modalOpen}
            onOpenChange={setModalOpen}
            nextSortOrder={nextSortOrder}
            onSaved={() => router.refresh()}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {editable
              ? "Tap an event to edit it or add new stops inline."
              : "Overview of the day's schedule."}
          </p>
        </div>
        {editable && showAddButton ? (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="size-4" />
            Add Event
          </Button>
        ) : null}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!sortable || !over || active.id === over.id) return;
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over.id);
          const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
            ...item,
            sortOrder: index + 1,
          }));
          setItems(reordered);
          void persistOrder(reordered);
        }}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {items.map((event) => (
              <div key={event.id}>
                <SortableEvent
                  event={event}
                  date={date}
                  sortable={sortable && editable}
                  onOpen={
                    editable
                      ? () => {
                          setSelectedEvent(event);
                          setModalOpen(true);
                        }
                      : undefined
                  }
                  onEdit={
                    editable
                      ? () => {
                          setSelectedEvent(event);
                          setModalOpen(true);
                        }
                      : undefined
                  }
                  onDelete={editable ? () => setEventToDelete(event) : undefined}
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editable ? (
        <>
          <EventModal
            dayId={dayId}
            date={date}
            open={modalOpen}
            onOpenChange={(open) => {
              setModalOpen(open);
              if (!open) setSelectedEvent(null);
            }}
            event={selectedEvent}
            nextSortOrder={nextSortOrder}
            onSaved={() => router.refresh()}
          />
          <Dialog
            open={Boolean(eventToDelete)}
            onOpenChange={(open) => {
              if (!open) setEventToDelete(null);
            }}
          >
            <DialogContent className="max-w-md bg-card p-6 sm:p-7">
              <DialogHeader>
                <DialogTitle>Delete Event?</DialogTitle>
                <DialogDescription>
                  {eventToDelete
                    ? `This will permanently delete "${eventToDelete.title}" from the schedule.`
                    : "This event will be permanently removed from the schedule."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 bg-transparent p-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEventToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (eventToDelete) {
                      void removeEvent(eventToDelete);
                    }
                  }}
                >
                  Delete Event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
