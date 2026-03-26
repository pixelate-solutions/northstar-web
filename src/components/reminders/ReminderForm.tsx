"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Reminder } from "@/db/schema";
import type { DaySummary } from "@/lib/types";

const emptyReminderForm = {
  title: "",
  body: "",
  dueDate: "",
  priority: "medium",
  dayId: "",
  isDone: false,
};

function getReminderForm(reminder: Reminder | null) {
  return reminder
    ? {
        title: reminder.title,
        body: reminder.body ?? "",
        dueDate: reminder.dueDate ?? "",
        priority: reminder.priority,
        dayId: reminder.dayId ? String(reminder.dayId) : "",
        isDone: reminder.isDone ?? false,
      }
    : emptyReminderForm;
}

export function ReminderForm({
  open,
  onOpenChange,
  reminder,
  days,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder: Reminder | null;
  days: DaySummary[];
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(() => getReminderForm(reminder));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card p-8">
        <DialogHeader>
          <DialogTitle>{reminder ? "Edit Reminder" : "Add Reminder"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              ...form,
              dayId: form.dayId || null,
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="reminder-title">Title</Label>
            <Input
              id="reminder-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reminder-body">Body</Label>
            <Textarea
              id="reminder-body"
              rows={3}
              value={form.body}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="reminder-date">Due Date</Label>
              <DatePicker
                id="reminder-date"
                value={form.dueDate}
                onChange={(value) => setForm({ ...form, dueDate: value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder-priority">Priority</Label>
              <select
                id="reminder-priority"
                className="h-8 rounded-lg border border-input bg-input/30 px-2.5 text-sm"
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reminder-day">Day</Label>
              <select
                id="reminder-day"
                className="h-8 rounded-lg border border-input bg-input/30 px-2.5 text-sm"
                value={form.dayId}
                onChange={(event) => setForm({ ...form, dayId: event.target.value })}
              >
                <option value="">None</option>
                {days.map((day) => (
                  <option key={day.id} value={day.id}>
                    Day {day.dayNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDone}
              onChange={(event) => setForm({ ...form, isDone: event.target.checked })}
            />
            Completed
          </label>
          <DialogFooter className="gap-2 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{reminder ? "Save Changes" : "Add Reminder"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
