import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

export function BudgetProgress({
  paid,
  booked,
}: {
  paid: number;
  booked: number;
}) {
  const percent = booked ? Math.round((paid / booked) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {formatCurrency(paid)} paid of {formatCurrency(booked)}
        </span>
        <span className="font-medium">{percent}%</span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
