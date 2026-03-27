import { BedDouble, CarFront, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DaySummary, DayWithDetails } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface TodaySnapshotProps {
  day: DaySummary | DayWithDetails;
}

export function TodaySnapshot({ day }: TodaySnapshotProps) {
  return (
    <Card className="min-w-0 overflow-hidden rounded-[2rem] border border-border/70 bg-card/85">
      <div className="relative h-72 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            day.coverImageUrl ??
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop"
          }
          alt={day.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <Badge className="border-primary/30 bg-primary/10 px-3 py-1 text-primary">
            Day {day.dayNumber}
          </Badge>
          <h2 className="mt-3 truncate text-3xl font-bold tracking-tight sm:text-4xl">
            {day.title}
          </h2>
          <div className="mt-3 flex min-w-0 flex-wrap gap-3 text-sm text-black">
            <span className="inline-flex min-w-0 items-center gap-2">
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="truncate">{day.location}</span>
            </span>
            <span>{formatDate(day.date)}</span>
          </div>
        </div>
      </div>
      <CardContent className="grid gap-4 py-5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl bg-secondary/60 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Sleep
          </p>
          <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
            <BedDouble className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{day.sleepLocation ?? "Not set"}</span>
          </div>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-4 sm:col-span-2 xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Drive Summary
          </p>
          <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
            <CarFront className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{day.driveInfo ?? "No major drive planned"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
