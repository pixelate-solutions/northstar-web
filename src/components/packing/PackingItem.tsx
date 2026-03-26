"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PackingItem as PackingItemType } from "@/db/schema";

interface PackingItemProps {
  item: PackingItemType;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PackingItem({ item, onToggle, onEdit, onDelete }: PackingItemProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3">
      <input
        type="checkbox"
        checked={Boolean(item.isPacked)}
        onChange={() => onToggle()}
        aria-label={`Mark ${item.name} packed`}
        className="mt-1 size-4 rounded border border-input accent-[var(--primary)]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{item.name}</p>
          <Badge className="bg-secondary text-foreground">x{item.quantity}</Badge>
          {item.isEssential ? (
            <Badge className="border-red-500/20 bg-red-500/10 text-red-700">
              Essential
            </Badge>
          ) : null}
        </div>
        {item.notes ? (
          <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${item.name}`}>
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Delete ${item.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
