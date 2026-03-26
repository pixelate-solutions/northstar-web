"use client";

import { CheckCircle2, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Reminder } from "@/db/schema";

interface ReminderCardProps {
  reminder: Reminder;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const priorityStyles = {
  high: "bg-red-500/10 text-red-700",
  medium: "bg-yellow-500/10 text-yellow-700",
  low: "bg-green-500/10 text-green-700",
};

export function ReminderCard({
  reminder,
  onToggle,
  onEdit,
  onDelete,
}: ReminderCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-border/60 bg-secondary/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{reminder.title}</p>
            <Badge className={priorityStyles[reminder.priority as keyof typeof priorityStyles]}>
              {reminder.priority}
            </Badge>
            {Boolean(reminder.isDone) ? (
              <Badge className="bg-green-500/10 text-green-700">Completed</Badge>
            ) : null}
          </div>
          {reminder.body ? (
            <p className="text-sm text-muted-foreground">{reminder.body}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Due {reminder.dueDate ?? "whenever"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onToggle}>
            <CheckCircle2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
