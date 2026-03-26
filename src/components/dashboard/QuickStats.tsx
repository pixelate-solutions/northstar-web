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
          <Card key={item.label} className="rounded-[1.75rem] border border-border/70 bg-card/80">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
