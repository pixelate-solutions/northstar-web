import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { expenses } from "@/db/schema";
import { requireRouteTripContext } from "@/lib/route-auth";
import { expensePatchSchema, parseJsonBody } from "@/lib/validation";

async function getOwnedExpense(expenseId: number) {
  const context = await requireRouteTripContext({ minimumRole: "collaborator" });
  if ("error" in context) {
    return context;
  }

  const expense = await context.db.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
  });

  if (!expense || expense.tripId !== context.activeTrip.id) {
    return {
      error: NextResponse.json({ error: "Expense not found." }, { status: 404 }),
    };
  }

  return {
    ...context,
    expense,
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getOwnedExpense(Number(id));
  if (!("expense" in context)) {
    return context.error;
  }

  const parsed = await parseJsonBody(request, expensePatchSchema);
  if ("error" in parsed) return parsed.error;
  const { amount, ...rest } = parsed.data;
  if (!Object.keys(parsed.data).length) return NextResponse.json(context.expense);

  const [updated] = await context.db
    .update(expenses)
    .set({ ...rest, ...(amount !== undefined ? { amount: String(amount) } : {}) })
    .where(eq(expenses.id, context.expense.id))
    .returning();

  return NextResponse.json(updated);
}

export const PATCH = PUT;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getOwnedExpense(Number(id));
  if (!("expense" in context)) {
    return context.error;
  }

  await context.db.delete(expenses).where(eq(expenses.id, context.expense.id));
  return NextResponse.json({ success: true });
}
