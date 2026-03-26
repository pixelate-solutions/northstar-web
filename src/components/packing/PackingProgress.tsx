import { Progress } from "@/components/ui/progress";

export function PackingProgress({
  packed,
  total,
}: {
  packed: number;
  total: number;
}) {
  const percent = total ? Math.round((packed / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {packed} of {total} packed
        </span>
        <span className="font-medium">{percent}%</span>
      </div>
      <Progress value={percent} />
    </div>
  );
}
