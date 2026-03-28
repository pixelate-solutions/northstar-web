"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string;
  onChange: (value: string | "") => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  className,
}: DatePickerProps) {
  const date = React.useMemo(() => (value ? parseISODate(value) : undefined), [value]);
  const [open, setOpen] = React.useState(false);
  const currentYear = React.useMemo(() => new Date().getFullYear(), []);
  const selectedYear = date?.getFullYear() ?? currentYear;
  const fromYear = Math.min(selectedYear, 2000);
  const toYear = Math.max(selectedYear + 5, currentYear + 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        render={
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start rounded-lg text-left font-normal shadow-none",
              !date && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="size-4" />
        {date
          ? date.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          fromYear={fromYear}
          toYear={toYear}
          initialFocus
          onSelect={(selectedDate) => {
            setOpen(false);
            if (!selectedDate || Number.isNaN(+selectedDate)) {
              onChange("");
              return;
            }
            onChange(toISODate(selectedDate));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year ?? 0, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODate(date: Date): string {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
