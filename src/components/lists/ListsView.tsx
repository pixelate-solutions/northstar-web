"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useTrip } from "@/components/trip/TripProvider";
import type { PackingJson, ReminderJson } from "@/lib/client-types";
import { shortDate, todayIso } from "@/lib/format";

const PACKING_CATEGORIES = ["documents", "clothing", "footwear", "gear", "electronics", "toiletries", "health", "accessories", "bags", "food", "other"];

export function Checkbox({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] transition active:scale-90 ${
        checked ? "bg-go" : "border-2 border-ink bg-white"
      }`}
    >
      {checked ? <Check size={14} strokeWidth={3} className="text-white" /> : null}
    </button>
  );
}

function AddRow({ placeholder, onAdd, children }: { placeholder: string; onAdd: (text: string) => void; children?: React.ReactNode }) {
  const [text, setText] = useState("");
  return (
    <form
      className="mb-2 flex h-12 items-center gap-3.5 rounded-[12px] bg-surface px-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return;
        onAdd(text.trim());
        setText("");
      }}
    >
      <Plus size={18} strokeWidth={2.4} className="shrink-0 text-muted" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] font-medium placeholder:text-muted"
      />
      {children}
    </form>
  );
}

function ReminderRow({ reminder }: { reminder: ReminderJson }) {
  const { updateReminder, deleteReminder, canEdit, bundle } = useTrip();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reminder.title);
  const [due, setDue] = useState(reminder.dueDate ?? "");
  const day = reminder.dayId ? bundle.days.find((d) => d.id === reminder.dayId) : null;
  const overdue = !reminder.isDone && reminder.dueDate && reminder.dueDate < todayIso();
  const tag = reminder.dueDate ? shortDate(reminder.dueDate) : day ? `Day ${day.dayNumber}` : null;

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2 border-b border-line py-2.5 pl-3.5 pr-2"
        onSubmit={(event) => {
          event.preventDefault();
          setEditing(false);
          const patch: Partial<ReminderJson> = {};
          if (title.trim() && title.trim() !== reminder.title) patch.title = title.trim();
          if ((due || null) !== reminder.dueDate) patch.dueDate = due || null;
          if (Object.keys(patch).length) void updateReminder(reminder.id, patch);
        }}
      >
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 min-w-0 flex-1 rounded-[10px] bg-surface px-3 text-[15px] font-medium" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-10 rounded-[10px] bg-surface px-2 font-mono text-[13px]" />
        <button type="button" aria-label="Delete" onClick={() => void deleteReminder(reminder.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-stop hover:bg-surface">
          <Trash2 size={16} />
        </button>
        <button type="submit" className="h-10 rounded-full bg-lane px-4 text-[14px] font-bold">Done</button>
      </form>
    );
  }

  return (
    <div className="flex h-[52px] items-center gap-3.5 border-b border-line px-3.5">
      <Checkbox
        checked={Boolean(reminder.isDone)}
        disabled={!canEdit}
        label={reminder.title}
        onChange={() => void updateReminder(reminder.id, { isDone: !reminder.isDone })}
      />
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setEditing(true)}
        className={`min-w-0 flex-1 truncate text-left text-[16px] font-medium ${reminder.isDone ? "text-muted line-through" : ""}`}
      >
        {reminder.title}
      </button>
      {tag && !reminder.isDone ? (
        <span className={`shrink-0 font-mono text-[13px] ${overdue ? "font-semibold text-stop" : day && !reminder.dueDate ? "font-semibold text-ink" : "font-medium text-muted"}`}>
          {tag}
        </span>
      ) : null}
    </div>
  );
}

function PackingRow({ item }: { item: PackingJson }) {
  const { updatePacking, deletePacking, canEdit } = useTrip();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity ?? 1));

  if (editing) {
    return (
      <form
        className="flex items-center gap-2 border-b border-line py-2.5 pl-3.5 pr-2"
        onSubmit={(event) => {
          event.preventDefault();
          setEditing(false);
          const patch: Partial<PackingJson> = {};
          const qty = Math.max(1, Number(quantity) || 1);
          if (name.trim() && name.trim() !== item.name) patch.name = name.trim();
          if (qty !== (item.quantity ?? 1)) patch.quantity = qty;
          if (Object.keys(patch).length) void updatePacking(item.id, patch);
        }}
      >
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-10 min-w-0 flex-1 rounded-[10px] bg-surface px-3 text-[15px] font-medium" />
        <input
          value={quantity}
          inputMode="numeric"
          onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
          className="h-10 w-14 rounded-[10px] bg-surface px-2 text-center font-mono text-[13px]"
          aria-label="Quantity"
        />
        <button type="button" aria-label="Delete" onClick={() => void deletePacking(item.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-stop hover:bg-surface">
          <Trash2 size={16} />
        </button>
        <button type="submit" className="h-10 rounded-full bg-lane px-4 text-[14px] font-bold">Done</button>
      </form>
    );
  }

  return (
    <div className="flex h-[52px] items-center gap-3.5 border-b border-line px-3.5">
      <Checkbox checked={Boolean(item.isPacked)} disabled={!canEdit} label={item.name} onChange={() => void updatePacking(item.id, { isPacked: !item.isPacked })} />
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setEditing(true)}
        className={`min-w-0 flex-1 truncate text-left text-[16px] font-medium ${item.isPacked ? "text-muted line-through" : ""}`}
      >
        {item.name}
      </button>
      <span className="shrink-0 font-mono text-[13px] font-medium text-muted">×{item.quantity ?? 1}</span>
    </div>
  );
}

function TodoColumn({ showDone }: { showDone: boolean }) {
  const { bundle, addReminder, canEdit } = useTrip();
  const reminders = useMemo(
    () =>
      [...bundle.reminders]
        .filter((r) => showDone || !r.isDone)
        .sort((a, b) => Number(Boolean(a.isDone)) - Number(Boolean(b.isDone)) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title)),
    [bundle.reminders, showDone]
  );
  const left = bundle.reminders.filter((r) => !r.isDone).length;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="hidden items-baseline justify-between px-1 pb-2.5 lg:flex">
        <h2 className="text-[20px] font-bold tracking-tightish">To do</h2>
        <span className="font-mono text-[13px] font-medium text-muted">{left} left</span>
      </div>
      {canEdit ? <AddRow placeholder="Add a to-do" onAdd={(title) => void addReminder({ title })} /> : null}
      {reminders.map((reminder) => (
        <ReminderRow key={reminder.id} reminder={reminder} />
      ))}
      {!reminders.length ? <p className="px-3.5 py-6 text-[15px] font-medium text-muted">{showDone ? "Nothing to do yet." : "All done."}</p> : null}
    </div>
  );
}

function PackingColumn({ showDone }: { showDone: boolean }) {
  const { bundle, addPacking, canEdit } = useTrip();
  const [category, setCategory] = useState("other");
  const groups = useMemo(() => {
    const visible = bundle.packingItems.filter((item) => showDone || !item.isPacked);
    const map = new Map<string, PackingJson[]>();
    for (const item of visible) {
      const key = item.category || "other";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "other" ? 1 : b === "other" ? -1 : a.localeCompare(b)))
      .map(([key, items]) => [key, items.sort((x, y) => Number(Boolean(x.isPacked)) - Number(Boolean(y.isPacked)) || x.name.localeCompare(y.name))] as const);
  }, [bundle.packingItems, showDone]);
  const packed = bundle.packingItems.filter((item) => item.isPacked).length;
  const categories = Array.from(new Set([...PACKING_CATEGORIES, ...bundle.packingItems.map((item) => item.category)]));

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="hidden items-baseline justify-between px-1 pb-2.5 lg:flex">
        <h2 className="text-[20px] font-bold tracking-tightish">Packing</h2>
        <span className="font-mono text-[13px] font-medium text-muted">
          {packed} / {bundle.packingItems.length}
        </span>
      </div>
      {canEdit ? (
        <AddRow placeholder="Add an item" onAdd={(name) => void addPacking({ name, category })}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Category"
            className="max-w-[120px] bg-transparent text-[13px] font-semibold capitalize text-muted"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </AddRow>
      ) : null}
      {groups.map(([key, items]) => (
        <div key={key} className="flex flex-col">
          <div className="px-3.5 pb-1 pt-4 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{key}</div>
          {items.map((item) => (
            <PackingRow key={item.id} item={item} />
          ))}
        </div>
      ))}
      {!groups.length ? <p className="px-3.5 py-6 text-[15px] font-medium text-muted">{showDone ? "Nothing to pack yet." : "All packed."}</p> : null}
    </div>
  );
}

export function ListsView() {
  const { bundle } = useTrip();
  const [showDone, setShowDone] = useState(true);
  const [tab, setTab] = useState<"todo" | "packing">("todo");
  const left = bundle.reminders.filter((r) => !r.isDone).length;
  const packed = bundle.packingItems.filter((item) => item.isPacked).length;

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-28 lg:pb-8">
      <div className="flex flex-col gap-4 px-5 pt-[max(env(safe-area-inset-top),20px)] lg:flex-row lg:items-end lg:justify-between lg:px-14 lg:pt-[72px]">
        <h1 className="text-[40px] font-extrabold leading-[42px] tracking-display lg:text-[44px] lg:leading-[46px]">Lists</h1>
        <div className="hidden rounded-full bg-surface p-1 lg:flex">
          {(["Open", "All"] as const).map((label) => {
            const active = (label === "All") === showDone;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setShowDone(label === "All")}
                className={`rounded-full px-3.5 py-[7px] text-[14px] ${active ? "bg-white font-bold shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "font-semibold text-muted"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex rounded-full bg-surface p-1 lg:hidden">
          {[
            { key: "todo" as const, label: "To do", meta: String(left) },
            { key: "packing" as const, label: "Packing", meta: `${packed}/${bundle.packingItems.length}` },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full text-[15px] ${
                tab === item.key ? "bg-white font-bold shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "font-semibold text-muted"
              }`}
            >
              {item.label}
              <span className="font-mono text-[12px] font-medium text-muted">{item.meta}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-14 px-4 pt-4 lg:px-14 lg:pt-8">
        <div className={`${tab === "todo" ? "flex" : "hidden"} min-w-0 flex-1 lg:flex`}>
          <TodoColumn showDone={showDone} />
        </div>
        <div className={`${tab === "packing" ? "flex" : "hidden"} min-w-0 flex-1 lg:flex`}>
          <PackingColumn showDone={showDone} />
        </div>
      </div>
    </div>
  );
}
