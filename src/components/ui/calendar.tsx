"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker";

import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

export function Calendar({
  className,
  classNames,
  formatters,
  showOutsideDays = true,
  captionLayout = "dropdown",
  navLayout = "around",
  ...props
}: DayPickerProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      navLayout={navLayout}
      formatters={{
        formatMonthDropdown: (date) => format(date, "MMM"),
        formatYearDropdown: (date) => format(date, "yyyy"),
        ...formatters,
      }}
      className={cn("rounded-lg border bg-background p-3", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("w-fit", defaultClassNames.months),
        month: cn("relative w-fit", defaultClassNames.month),
        month_caption: cn(
          "flex min-h-9 items-center justify-center px-8 pb-4 pt-1",
          defaultClassNames.month_caption
        ),
        dropdowns: cn("inline-flex items-center gap-1.5", defaultClassNames.dropdowns),
        dropdown_root: cn(
          "relative inline-flex items-center gap-1 text-sm font-medium text-foreground",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 cursor-pointer opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn("inline-flex items-center gap-1 text-sm font-medium text-foreground", defaultClassNames.caption_label),
        nav: cn("flex items-center gap-1", defaultClassNames.nav),
        button_previous: cn(
          "absolute left-1 top-1 inline-flex size-7 items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-foreground transition hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-35",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          "absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-foreground transition hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-35",
          defaultClassNames.button_next
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn("w-9 text-sm font-normal text-muted-foreground", defaultClassNames.weekday),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn("relative h-9 w-9 p-0 text-center text-sm", defaultClassNames.day),
        day_button: cn(
          "h-9 w-9 rounded-md border border-transparent p-0 text-sm font-normal text-foreground transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          defaultClassNames.day_button
        ),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", className)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("size-4", className)} {...iconProps} />
          ),
      }}
      {...props}
    />
  );
}
