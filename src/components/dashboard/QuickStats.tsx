import { CalendarRange, DollarSign, Package, Route } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function QuickStats({ stats }: { stats: DashboardStats }) {
  const items = [
    {
      label: stats.statLabel,
      value: stats.daysUntilOrIntoTrip.toString(),
      icon: CalendarRange,
    },
    {
      label: "events on this day",
      value: stats.eventsToday.toString(),
      icon: Route,
    },
    {
      label: "packing complete",
      value: `${stats.packingPercent}%`,
      icon: Package,
    },
    {
      label: "paid so far",
      value: formatCurrency(stats.totalSpent),
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="min-w-0 rounded-[1.75rem] border border-border/70 bg-card/80">
            <CardContent className="flex min-w-0 items-center gap-4 py-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-2xl font-semibold tracking-tight">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
