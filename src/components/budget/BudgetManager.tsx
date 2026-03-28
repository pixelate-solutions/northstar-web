"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BudgetProgress } from "@/components/budget/BudgetProgress";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { ExpenseTable } from "@/components/budget/ExpenseTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Expense } from "@/db/schema";
import { formatCurrency } from "@/lib/utils";

const emptyExpenseForm = {
  description: "",
  category: "other",
  amount: "0",
  isBooked: false,
  isPaid: false,
  purchaseDate: "",
  notes: "",
  receiptUrl: "",
};

function getExpenseForm(expense: Expense | null) {
  return expense
    ? {
        description: expense.description,
        category: expense.category,
        amount: String(expense.amount ?? 0),
        isBooked: expense.isBooked ?? false,
        isPaid: expense.isPaid ?? false,
        purchaseDate: expense.purchaseDate ?? "",
        notes: expense.notes ?? "",
        receiptUrl: expense.receiptUrl ?? "",
      }
    : emptyExpenseForm;
}

export function BudgetManager({
  initialExpenses,
  canEdit = true,
}: {
  initialExpenses: Expense[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [foodEstimate, setFoodEstimate] = useState("60");

  const totalBooked = initialExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );
  const totalPaid = initialExpenses
    .filter((expense) => Boolean(expense.isPaid))
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const remaining = totalBooked - totalPaid;
  const estimatedFood = Number(foodEstimate || 0) * 11;

  async function saveExpense(payload: Record<string, unknown>) {
    const response = await fetch(
      editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses",
      {
        method: editingExpense ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      toast.error("Unable to save expense.");
      return;
    }

    toast.success(editingExpense ? "Expense updated." : "Expense added.");
    setModalOpen(false);
    setEditingExpense(null);
    router.refresh();
  }

  async function deleteExpense(expense: Expense) {
    if (!window.confirm(`Delete "${expense.description}"?`)) return;
    const response = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("Unable to delete expense.");
      return;
    }
    toast.success("Expense deleted.");
    router.refresh();
  }

  async function markPaid(expense: Expense) {
    const response = await fetch(`/api/expenses/${expense.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: true }),
    });
    if (!response.ok) {
      toast.error("Unable to mark expense as paid.");
      return;
    }
    toast.success("Expense marked as paid.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[2rem] border border-border/70 bg-card/80">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Total Budget Summary</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Track booked, paid, and remaining trip spend.
              </p>
            </div>
            {canEdit ? (
              <Button
                onClick={() => {
                  setEditingExpense(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add Expense
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Booked" value={formatCurrency(totalBooked)} />
              <SummaryCard label="Paid" value={formatCurrency(totalPaid)} />
              <SummaryCard label="Remaining" value={formatCurrency(remaining)} />
            </div>
            <BudgetProgress paid={totalPaid} booked={totalBooked} />
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>Food Budget Estimator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="foodEstimate">Estimated daily food spend</Label>
              <Input
                id="foodEstimate"
                value={foodEstimate}
                onChange={(event) => setFoodEstimate(event.target.value)}
              />
            </div>
            <div className="rounded-2xl bg-secondary/40 p-4">
              <p className="text-sm text-muted-foreground">11-day estimate</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCurrency(estimatedFood)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {initialExpenses.length ? (
        <>
          <BudgetSummary expenses={initialExpenses} />
          <ExpenseTable
            expenses={initialExpenses}
            editable={canEdit}
            onEdit={(expense) => {
              setEditingExpense(expense);
              setModalOpen(true);
            }}
            onDelete={(expense) => void deleteExpense(expense)}
            onMarkPaid={(expense) => void markPaid(expense)}
          />
        </>
      ) : (
        <EmptyState
          title="No expenses yet"
          description={
            canEdit
              ? "Add expenses to start tracking booked and paid trip costs."
              : "No expenses have been added to this trip yet."
          }
          actionLabel={canEdit ? "Add Expense" : undefined}
          onAction={canEdit ? () => setModalOpen(true) : undefined}
        />
      )}

      {canEdit ? (
        <ExpenseDialog
          key={`${editingExpense?.id ?? "new"}-${modalOpen ? "open" : "closed"}`}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setEditingExpense(null);
          }}
          expense={editingExpense}
          onSubmit={(payload) => void saveExpense(payload)}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(() => getExpenseForm(expense));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(form);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="expense-category">Category</Label>
              <Input
                id="expense-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-date">Purchase Date</Label>
            <DatePicker
              id="expense-date"
              value={form.purchaseDate}
              onChange={(value) => setForm({ ...form, purchaseDate: value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-notes">Notes</Label>
            <Textarea
              id="expense-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isBooked}
              onChange={(event) => setForm({ ...form, isBooked: event.target.checked })}
            />
            Booked
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPaid}
              onChange={(event) => setForm({ ...form, isPaid: event.target.checked })}
            />
            Paid
          </label>
          <DialogFooter className="gap-2 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{expense ? "Save Changes" : "Add Expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
