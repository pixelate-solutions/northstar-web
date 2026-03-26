import Image from "next/image";
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
    <Card className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/85">
      <div className="relative h-72 overflow-hidden">
        <Image
          src={
            day.coverImageUrl ??
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop"
          }
          alt={day.title}
          fill
          sizes="(max-width: 1280px) 100vw, 60vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <Badge className="border-primary/30 bg-primary/10 px-3 py-1 text-primary">
            Day {day.dayNumber}
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {day.title}
          </h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-black">
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              {day.location}
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
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-foreground">
            <BedDouble className="size-4 text-primary" />
            {day.sleepLocation ?? "Not set"}
          </p>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-4 sm:col-span-2 xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Drive Summary
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-foreground">
            <CarFront className="size-4 text-primary" />
            {day.driveInfo ?? "No major drive planned"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
