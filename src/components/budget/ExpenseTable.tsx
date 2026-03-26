"use client";

import { CheckCircle2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Expense } from "@/db/schema";
import { formatCurrency } from "@/lib/utils";

interface ExpenseTableProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onMarkPaid: (expense: Expense) => void;
}

export function ExpenseTable({
  expenses,
  onEdit,
  onDelete,
  onMarkPaid,
}: ExpenseTableProps) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-t border-border/60">
                <td className="px-4 py-4">
                  <div>
                    <p className="font-medium">{expense.description}</p>
                    {expense.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{expense.notes}</p>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Badge className="capitalize bg-secondary text-foreground">
                    {expense.category.replaceAll("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-4 font-medium">{formatCurrency(expense.amount)}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {Boolean(expense.isBooked) ? (
                      <Badge className="bg-primary/10 text-primary">Booked</Badge>
                    ) : null}
                    {Boolean(expense.isPaid) ? (
                      <Badge className="bg-green-500/10 text-green-700">Paid</Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-700">Unpaid</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">
                  {expense.purchaseDate ?? "N/A"}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1">
                    {!Boolean(expense.isPaid) ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onMarkPaid(expense)}
                        aria-label={`Mark ${expense.description} paid`}
                      >
                        <CheckCircle2 className="size-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(expense)}
                      aria-label={`Edit ${expense.description}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(expense)}
                      aria-label={`Delete ${expense.description}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
