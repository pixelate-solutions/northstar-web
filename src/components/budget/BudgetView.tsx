"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/lists/ListsView";
import { useConfirm } from "@/components/ns/overlay";
import { useTrip } from "@/components/trip/TripProvider";
import { useCheckedOrder, useFlip } from "@/hooks/useCheckedOrder";
import type { ExpenseJson } from "@/lib/client-types";
import { money, shortDate } from "@/lib/format";

function categoryLabel(value: string) {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "Other";
}

const SEGMENT_COLORS = ["#111110", "#FFC500", "#8A8A84", "#CFCFCA"];
const DEFAULT_CATEGORIES = ["Stays", "Food", "Car & gas", "Flights", "Activities", "Other"];

function ExpenseRow({ expense, categories, onToggled }: { expense: ExpenseJson; categories: string[]; onToggled: (id: number, previous: boolean) => void }) {
  const { updateExpense, deleteExpense, canEdit } = useTrip();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(String(Number(expense.amount)));
  const [category, setCategory] = useState(expense.category);

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2 border-b border-line py-2.5 pl-3.5 pr-2"
        onSubmit={(event) => {
          event.preventDefault();
          setEditing(false);
          const patch: Parameters<typeof updateExpense>[1] = {};
          if (description.trim() && description.trim() !== expense.description) patch.description = description.trim();
          if (Number(amount) !== Number(expense.amount) && !Number.isNaN(Number(amount))) patch.amount = Number(amount);
          if (category !== expense.category) patch.category = category;
          if (Object.keys(patch).length) void updateExpense(expense.id, patch);
        }}
      >
        <input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 min-w-[140px] flex-1 rounded-[10px] bg-surface px-3 text-[15px] font-medium" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-[10px] bg-surface px-2 text-[14px] font-semibold">
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
        <input
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          className="h-10 w-24 rounded-[10px] bg-surface px-2 text-right font-mono text-[14px]"
          aria-label="Amount"
        />
        <button type="button" aria-label="Delete" onClick={async () => {
            if (!(await confirm(`Delete ${expense.description}?`))) return;
            setEditing(false);
            void deleteExpense(expense.id);
          }} className="flex h-10 w-10 items-center justify-center rounded-full text-stop hover:bg-surface">
          <Trash2 size={16} />
        </button>
        <button type="submit" className="h-10 rounded-full bg-lane px-4 text-[14px] font-bold">Done</button>
      </form>
    );
  }

  return (
    <div className="flex h-[54px] items-center gap-4 border-b border-line px-3.5">
      <Checkbox
        checked={Boolean(expense.isPaid)}
        disabled={!canEdit}
        label={expense.description}
        onChange={() => {
          onToggled(expense.id, Boolean(expense.isPaid));
          void updateExpense(expense.id, { isPaid: !expense.isPaid });
        }}
      />
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setEditing(true)}
        className={`min-w-0 flex-1 truncate text-left text-[16px] font-medium ${expense.isPaid ? "text-muted line-through" : ""}`}
      >
        {expense.description}
      </button>
      <span className="hidden w-[110px] shrink-0 truncate text-[14px] font-medium text-muted sm:block">{categoryLabel(expense.category)}</span>
      <span className="hidden w-[60px] shrink-0 font-mono text-[13px] font-medium text-muted sm:block">{shortDate(expense.purchaseDate)}</span>
      <span className={`w-[92px] shrink-0 text-right font-mono text-[15px] font-semibold ${expense.isPaid ? "text-muted" : ""}`}>{money(expense.amount, true)}</span>
    </div>
  );
}

export function BudgetView() {
  const { bundle, addExpense, canEdit } = useTrip();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");

  const total = bundle.expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const paid = bundle.expenses.filter((e) => e.isPaid).reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const stopCosts = bundle.days.reduce((sum, day) => sum + day.events.reduce((s, e) => s + Number(e.cost ?? 0), 0), 0);
  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...bundle.expenses.map((e) => e.category)]));

  const segments = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const expense of bundle.expenses) byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + Number(expense.amount ?? 0));
    const sorted = [...byCategory.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 3);
    const rest = sorted.slice(3).reduce((sum, [, v]) => sum + v, 0);
    return rest > 0 ? [...top, ["Everything else", rest] as [string, number]] : top;
  }, [bundle.expenses]);

  const { toggled, compareChecked } = useCheckedOrder();
  const expenses = [...bundle.expenses].sort(
    (a, b) =>
      compareChecked({ id: a.id, checked: Boolean(a.isPaid) }, { id: b.id, checked: Boolean(b.isPaid) }) ||
      (a.purchaseDate ?? "9999").localeCompare(b.purchaseDate ?? "9999") ||
      a.id - b.id
  );
  const flipRef = useFlip<HTMLDivElement>(expenses.map((e) => e.id).join(","));

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-5 pb-28 pt-[max(env(safe-area-inset-top),20px)] lg:gap-9 lg:px-14 lg:pb-8 lg:pt-[72px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Trip total</span>
          <span className="text-[56px] font-extrabold leading-[58px] tracking-[-0.045em] lg:text-[72px] lg:leading-[72px]">{money(total)}</span>
        </div>
        <div className="flex flex-wrap gap-5 lg:gap-10 lg:pb-2">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-muted">Paid</span>
            <span className="font-mono text-[18px] font-semibold text-go lg:text-[22px]">{money(paid)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-muted">Still to pay</span>
            <span className="font-mono text-[18px] font-semibold lg:text-[22px]">{money(total - paid)}</span>
          </div>
          {stopCosts > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-muted">Stop costs</span>
              <span className="font-mono text-[18px] font-semibold lg:text-[22px]">{money(stopCosts)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {segments.length ? (
        <div className="flex flex-col gap-3.5">
          <div className="flex h-3.5 gap-[3px]">
            {segments.map(([name, value], i) => (
              <div key={name} className="h-full rounded-[4px]" style={{ width: `${(value / total) * 100}%`, background: SEGMENT_COLORS[i] }} title={`${name} ${money(value)}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-2">
            {segments.map(([name, value], i) => (
              <span key={name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SEGMENT_COLORS[i] }} />
                <span className="text-[14px] font-semibold">{categoryLabel(name)}</span>
                <span className="font-mono text-[13px] font-medium text-muted">{money(value)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
        {canEdit ? (
          <form
            className="mb-2 flex flex-wrap items-center gap-2 rounded-[12px] bg-surface py-1.5 pl-3.5 pr-1.5 sm:h-12 sm:flex-nowrap sm:py-0"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(amount);
              if (!description.trim() || !amount || Number.isNaN(value)) return;
              void addExpense({ description: description.trim(), amount: value, category });
              setDescription("");
              setAmount("");
            }}
          >
            <Plus size={18} strokeWidth={2.4} className="shrink-0 text-muted" />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an expense"
              className="h-9 min-w-0 flex-1 basis-[calc(100%-40px)] bg-transparent text-[15px] font-medium placeholder:text-muted sm:basis-auto"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="ml-7 h-9 flex-1 bg-transparent text-[13px] font-semibold text-muted sm:ml-0 sm:flex-none" aria-label="Category">
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={amount}
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="$0"
              className="h-9 w-20 rounded-[8px] bg-white px-2 text-right font-mono text-[14px] placeholder:text-faint"
              aria-label="Amount"
            />
            <button type="submit" className="h-9 rounded-full bg-ink px-4 text-[13px] font-bold text-white">Add</button>
          </form>
        ) : null}
        <div ref={flipRef} className="flex flex-col">
          {expenses.map((expense) => (
            <div key={expense.id} data-flip-id={expense.id} className="bg-white">
              <ExpenseRow expense={expense} categories={categories} onToggled={toggled} />
            </div>
          ))}
        </div>
        {!expenses.length ? <p className="px-3.5 py-6 text-[15px] font-medium text-muted">No expenses yet.</p> : null}
      </div>
    </div>
  );
}
