import { CalendarRange, DollarSign, Package, Route } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/types";
import { formatCurrency, pluralize } from "@/lib/utils";

export function QuickStats({ stats }: { stats: DashboardStats }) {
  const items = [
    {
      label: stats.statLabel,
      value: stats.daysUntilOrIntoTrip.toString(),
      icon: CalendarRange,
    },
    {
      label: `${pluralize(stats.eventsToday, "event")} on this day`,
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
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="min-w-0 rounded-[1.75rem] border border-border/70 bg-card/80">
            <CardContent className="flex min-w-0 items-center gap-3 px-3 py-4 sm:gap-4 sm:px-6 sm:py-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:size-11">
                <Icon className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight sm:text-2xl">
                  {item.value}
                </p>
                <p className="text-xs leading-4 text-muted-foreground sm:text-sm sm:leading-5">
                  {item.label}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
