"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { MobileDayNavigator } from "@/components/shared/MobileDayNavigator";
import { PackingCategory } from "@/components/packing/PackingCategory";
import { PackingProgress } from "@/components/packing/PackingProgress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { DaySummary } from "@/lib/types";
import type { PackingItem as PackingItemType } from "@/db/schema";

type FilterMode = "all" | "not-packed" | "essential";

const DEFAULT_PACKING_CATEGORIES = [
  "documents",
  "electronics",
  "clothing",
  "gear",
  "food",
  "toiletries",
  "other",
];

const defaultForm = {
  name: "",
  category: "other",
  quantity: 1,
  isPacked: false,
  isEssential: false,
  daySpecific: "",
  notes: "",
};

function getPackingForm(initialItem: PackingItemType | null) {
  return initialItem
    ? {
        name: initialItem.name,
        category: initialItem.category,
        quantity: initialItem.quantity ?? 1,
        isPacked: initialItem.isPacked ?? false,
        isEssential: initialItem.isEssential ?? false,
        daySpecific: initialItem.daySpecific ? String(initialItem.daySpecific) : "",
        notes: initialItem.notes ?? "",
      }
    : defaultForm;
}

function formatCategoryLabel(category: string) {
  return category
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isString(value: string | null | undefined): value is string {
  return Boolean(value);
}

export function PackingManager({
  initialItems,
  days,
  canEdit = true,
}: {
  initialItems: PackingItemType[];
  days: DaySummary[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackingItemType | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === "not-packed" && Boolean(item.isPacked)) return false;
      if (filter === "essential" && !Boolean(item.isEssential)) return false;
      if (dayFilter !== "all" && String(item.daySpecific ?? "") !== dayFilter) return false;
      return true;
    });
  }, [dayFilter, filter, items]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce<Record<string, PackingItemType[]>>((acc, item) => {
      acc[item.category] ??= [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [filteredItems]);

  const packedCount = items.filter((item) => Boolean(item.isPacked)).length;
  const selectedDayIndex =
    dayFilter === "all" ? null : days.findIndex((day) => String(day.id) === dayFilter);
  const packingCategories = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_PACKING_CATEGORIES,
          ...items.map((item) => item.category).filter(isString),
        ])
      ).sort((a, b) => formatCategoryLabel(a).localeCompare(formatCategoryLabel(b))),
    [items]
  );

  async function upsertItem(payload: Record<string, unknown>) {
    const response = await fetch(
      editingItem ? `/api/packing/${editingItem.id}` : "/api/packing",
      {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      toast.error("Unable to save packing item.");
      return;
    }

    toast.success(editingItem ? "Packing item updated." : "Packing item added.");
    setModalOpen(false);
    setEditingItem(null);
    router.refresh();
  }

  async function toggleItem(item: PackingItemType) {
    const newPacked = !Boolean(item.isPacked);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isPacked: newPacked } : i))
    );
    const response = await fetch(`/api/packing/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ isPacked: newPacked }),
    });
    if (!response.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isPacked: item.isPacked } : i))
      );
      toast.error("Unable to update packing item.");
      return;
    }

    const updated = (await response.json().catch(() => null)) as PackingItemType | null;
    if (updated) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    }
    router.refresh();
  }

  async function deleteItem(item: PackingItemType) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    const response = await fetch(`/api/packing/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Unable to delete packing item.");
      return;
    }
    toast.success("Packing item deleted.");
    router.refresh();
  }

  async function packAll(items: PackingItemType[]) {
    const pendingItems = items.filter((item) => !Boolean(item.isPacked));
    setItems((prev) =>
      prev.map((item) =>
        pendingItems.some((pending) => pending.id === item.id)
          ? { ...item, isPacked: true }
          : item
      )
    );

    const responses = await Promise.all(
      pendingItems.map((item) =>
        fetch(`/api/packing/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ isPacked: true }),
        })
      )
    );

    if (responses.some((response) => !response.ok)) {
      toast.error("Unable to update some packing items.");
      router.refresh();
      return;
    }

    toast.success("Category packed.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6">
          <h2 className="text-xl font-semibold">Overall Progress</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep tabs on the full packing list before leaving Detroit.
          </p>
          <div className="mt-5">
            <PackingProgress packed={packedCount} total={initialItems.length} />
          </div>
        </div>
        <div className="flex items-center justify-end rounded-[2rem] border border-border/70 bg-card/80 p-6">
          {canEdit ? (
            <Button
              onClick={() => {
                setEditingItem(null);
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add Item
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-card/80 p-4">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterMode)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="not-packed">Not Packed</TabsTrigger>
            <TabsTrigger value="essential">Essential Only</TabsTrigger>
          </TabsList>
        </Tabs>
        <MobileDayNavigator
          className="sm:hidden"
          days={days}
          selectedIndex={selectedDayIndex}
          allowWholeTrip
          onSelectIndex={(index) => {
            if (index === null) {
              setDayFilter("all");
              return;
            }

            const day = days[index];
            if (day) {
              setDayFilter(String(day.id));
            }
          }}
        />
        <div className="hidden flex-wrap gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setDayFilter("all")}
            className={`rounded-full border px-4 py-2 text-sm ${
              dayFilter === "all"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/70 bg-card text-muted-foreground"
            }`}
          >
            Whole Trip
          </button>
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setDayFilter(String(day.id))}
              onDoubleClick={() => router.push(`/app/days/${day.date}`)}
              className={`rounded-full border px-4 py-2 text-sm ${
                dayFilter === String(day.id)
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/70 bg-card text-muted-foreground"
              }`}
            >
              Day {day.dayNumber}
            </button>
          ))}
        </div>
      </div>

      {Object.keys(groupedItems).length ? (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <PackingCategory
              key={category}
              category={category}
              items={items}
              editable={canEdit}
              onToggle={(item) => void toggleItem(item)}
              onEdit={(item) => {
                setEditingItem(item);
                setModalOpen(true);
              }}
              onDelete={(item) => void deleteItem(item)}
              onPackAll={() => void packAll(items)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No packing items match this filter"
          description={
            canEdit
              ? "Try a different filter or add a new item."
              : "Try a different filter."
          }
          actionLabel={canEdit ? "Add Item" : undefined}
          onAction={canEdit ? () => setModalOpen(true) : undefined}
        />
      )}

      {canEdit ? (
        <PackingItemDialog
          key={`${editingItem?.id ?? "new"}-${modalOpen ? "open" : "closed"}`}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setEditingItem(null);
          }}
          days={days}
          categories={packingCategories}
          initialItem={editingItem}
          onSubmit={(payload) => void upsertItem(payload)}
        />
      ) : null}
    </div>
  );
}

function PackingItemDialog({
  open,
  onOpenChange,
  days,
  categories,
  initialItem,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: DaySummary[];
  categories: string[];
  initialItem: PackingItemType | null;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(() => getPackingForm(initialItem));
  const categoryOptions = useMemo(
    () =>
      Array.from(new Set([...categories, form.category].filter(isString))).sort((a, b) =>
        formatCategoryLabel(a).localeCompare(formatCategoryLabel(b))
      ),
    [categories, form.category]
  );
  const selectedDay = days.find((day) => String(day.id) === form.daySpecific);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card p-6 sm:p-7">
        <DialogHeader>
          <DialogTitle>{initialItem ? "Edit Packing Item" : "Add Packing Item"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-5 px-1"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              ...form,
              daySpecific: form.daySpecific || null,
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="packing-name">Name</Label>
            <Input
              id="packing-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="packing-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(category) => {
                  if (category) {
                    setForm({ ...form, category });
                  }
                }}
              >
                <SelectTrigger
                  id="packing-category"
                  className="w-full hover:cursor-pointer"
                >
                  <SelectValue>{formatCategoryLabel(form.category)}</SelectValue>
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="max-h-56 overflow-y-auto"
                >
                  {categoryOptions.map((category) => (
                    <SelectItem
                      key={category}
                      value={category}
                      className="hover:cursor-pointer hover:bg-accent/10 focus:bg-accent/10 focus:text-foreground"
                    >
                      {formatCategoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="packing-quantity">Quantity</Label>
              <Input
                id="packing-quantity"
                type="number"
                value={form.quantity}
                onChange={(event) =>
                  setForm({ ...form, quantity: Number(event.target.value) })
                }
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="packing-day">Day Specific</Label>
            <Select
              value={form.daySpecific || "whole-trip"}
              onValueChange={(daySpecific) => {
                setForm({
                  ...form,
                  daySpecific:
                    !daySpecific || daySpecific === "whole-trip" ? "" : daySpecific,
                });
              }}
            >
              <SelectTrigger id="packing-day" className="w-full hover:cursor-pointer">
                <SelectValue>
                  {selectedDay ? `Day ${selectedDay.dayNumber}` : "Whole trip"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className="max-h-56 overflow-y-auto"
              >
                <SelectItem
                  value="whole-trip"
                  className="hover:cursor-pointer hover:bg-accent/10 focus:bg-accent/10 focus:text-foreground"
                >
                  Whole trip
                </SelectItem>
                {days.map((day) => (
                  <SelectItem
                    key={day.id}
                    value={String(day.id)}
                    className="hover:cursor-pointer hover:bg-accent/10 focus:bg-accent/10 focus:text-foreground"
                  >
                    Day {day.dayNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="packing-notes">Notes</Label>
            <Textarea
              id="packing-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isEssential}
              onChange={(event) =>
                setForm({ ...form, isEssential: event.target.checked })
              }
            />
            Essential item
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPacked}
              onChange={(event) => setForm({ ...form, isPacked: event.target.checked })}
            />
            Already packed
          </label>
          <DialogFooter className="gap-2 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{initialItem ? "Save Changes" : "Add Item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
