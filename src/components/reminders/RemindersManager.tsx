"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import { ReminderForm } from "@/components/reminders/ReminderForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reminder } from "@/db/schema";
import type { DaySummary } from "@/lib/types";

export function RemindersManager({
  initialReminders,
  days,
}: {
  initialReminders: Reminder[];
  days: DaySummary[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");

  const sections = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return {
      overdue: initialReminders.filter(
        (item) =>
          Boolean(item.dueDate) &&
          !Boolean(item.isDone) &&
          (item.dueDate ?? "") < today
      ),
      today: initialReminders.filter(
        (item) => !Boolean(item.isDone) && (item.dueDate ?? "") === today
      ),
      upcoming: initialReminders.filter(
        (item) => !Boolean(item.isDone) && (!item.dueDate || item.dueDate > today)
      ),
      completed: initialReminders.filter((item) => Boolean(item.isDone)),
    };
  }, [initialReminders]);

  async function saveReminder(payload: Record<string, unknown>) {
    const response = await fetch(
      editingReminder ? `/api/reminders/${editingReminder.id}` : "/api/reminders",
      {
        method: editingReminder ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      toast.error("Unable to save reminder.");
      return;
    }
    toast.success(editingReminder ? "Reminder updated." : "Reminder added.");
    setModalOpen(false);
    setEditingReminder(null);
    router.refresh();
  }

  async function toggleReminder(reminder: Reminder) {
    const response = await fetch(`/api/reminders/${reminder.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: !Boolean(reminder.isDone) }),
    });
    if (!response.ok) {
      toast.error("Unable to update reminder.");
      return;
    }
    router.refresh();
  }

  async function deleteReminder(reminder: Reminder) {
    if (!window.confirm(`Delete "${reminder.title}"?`)) return;
    const response = await fetch(`/api/reminders/${reminder.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Unable to delete reminder.");
      return;
    }
    toast.success("Reminder deleted.");
    router.refresh();
  }

  async function quickAdd() {
    if (!quickAddTitle.trim()) return;
    await saveReminder({ title: quickAddTitle, priority: "medium", isDone: false });
    setQuickAddTitle("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-[2rem] border border-border/70 bg-card/80 p-4 sm:flex-row">
        <input
          value={quickAddTitle}
          onChange={(event) => setQuickAddTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void quickAdd();
            }
          }}
          placeholder="Quick add a reminder and press Enter"
          className="h-12 flex-1 rounded-2xl border border-input bg-input/30 px-4 text-sm outline-none"
        />
        <Button
          onClick={() => {
            setEditingReminder(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add Reminder
        </Button>
      </div>

      {(
        [
          ["Overdue", sections.overdue],
          ["Today", sections.today],
          ["Upcoming", sections.upcoming],
          ["Completed", sections.completed],
        ] as const
      ).map(([label, reminders]) => (
        <Card key={label} className="rounded-[2rem] border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>{label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reminders.length ? (
              reminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onToggle={() => void toggleReminder(reminder)}
                  onEdit={() => {
                    setEditingReminder(reminder);
                    setModalOpen(true);
                  }}
                  onDelete={() => void deleteReminder(reminder)}
                />
              ))
            ) : (
              <EmptyState
                title={`No ${label.toLowerCase()} reminders`}
                description="This section is clear right now."
              />
            )}
          </CardContent>
        </Card>
      ))}

      <ReminderForm
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingReminder(null);
        }}
        reminder={editingReminder}
        days={days}
        onSubmit={(payload) => void saveReminder(payload)}
      />
    </div>
  );
}
