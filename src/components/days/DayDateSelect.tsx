"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DaySummary } from "@/lib/types";
import { formatDate, formatDateShort } from "@/lib/utils";

export function DayDateSelect({
  days,
  currentDate,
}: {
  days: Pick<DaySummary, "id" | "date" | "dayNumber" | "title">[];
  currentDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentDay = days.find((day) => day.date === currentDate);

  return (
    <Select
      value={currentDate}
      onValueChange={(nextDate) => {
        if (nextDate === currentDate) {
          return;
        }

        startTransition(() => {
          router.push(`/app/days/${nextDate}`);
        });
      }}
      disabled={isPending || days.length <= 1}
    >
      <SelectTrigger className="h-auto max-w-full rounded-full border-0 bg-secondary px-4 py-2 text-base font-semibold text-foreground shadow-none hover:bg-secondary/80 focus-visible:ring-primary/20 data-[size=default]:h-auto">
        <SelectValue>
          {currentDay ? formatDate(currentDay.date) : formatDate(currentDate)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className="max-h-72 min-w-64 overflow-y-auto"
      >
        {days.map((day) => (
          <SelectItem
            key={day.id}
            value={day.date}
            className="hover:cursor-pointer hover:bg-accent/10 focus:bg-accent/10 focus:text-foreground"
          >
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="font-medium">
                Day {day.dayNumber} · {formatDateShort(day.date)}
              </span>
              <span className="max-w-56 truncate text-xs text-muted-foreground">
                {day.title}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
