import Image from "next/image";
import Link from "next/link";
import { BedDouble, CalendarDays, CarFront, Map as MapIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { WeatherChip } from "@/components/shared/WeatherChip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildMetadata } from "@/lib/metadata";
import { getDaysOverview } from "@/lib/server-data";
import { formatDateMedium } from "@/lib/utils";

export const metadata = buildMetadata("All Days");
export const dynamic = "force-dynamic";

export default async function DaysOverviewPage() {
  const days = await getDaysOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trip Route"
        title="All 11 Days"
        description="Browse the entire Southwest itinerary as an overview grid."
      />

      <div className="grid gap-3 rounded-[2rem] border border-white/40 bg-white/32 p-3 shadow-[0_18px_42px_rgba(191,102,62,0.08)] backdrop-blur-xl md:grid-cols-3">
        <Link
          href="/days"
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] border border-white/55 bg-white/72 px-4 py-3 text-sm font-medium text-foreground shadow-[0_10px_24px_rgba(191,102,62,0.08)]"
        >
          <CalendarDays className="size-4" />
          Days
        </Link>
        <Link
          href="/calendar"
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] border border-transparent bg-white/10 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-white/35 hover:bg-white/36 hover:text-foreground"
        >
          <CalendarDays className="size-4" />
          Calendar
        </Link>
        <Link
          href="/map"
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] border border-transparent bg-white/10 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-white/35 hover:bg-white/36 hover:text-foreground"
        >
          <MapIcon className="size-4" />
          Map
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {days.map((day) => (
          <Link key={day.id} href={`/days/${day.date}`}>
            <Card className="h-full overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 transition hover:-translate-y-1 hover:border-primary/20">
              <div className="relative h-56">
                <Image
                  src={
                    day.coverImageUrl ??
                    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop"
                  }
                  alt={day.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                <div className="absolute left-5 top-5">
                  <Badge className="bg-white/90 text-primary shadow-sm backdrop-blur-sm">
                    Day {day.dayNumber}
                  </Badge>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h2 className="text-xl font-semibold text-white drop-shadow">{day.title}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-white/75">
                    <span>{day.location}</span>
                    <span>·</span>
                    <span>{formatDateMedium(day.date)}</span>
                  </p>
                </div>
              </div>
              <CardContent className="space-y-4 py-5">
                <div className="flex flex-wrap gap-2">
                  {day.events.slice(0, 4).map((event) => (
                    <Badge key={event.id} className="bg-secondary/70 text-foreground">
                      {event.title}
                    </Badge>
                  ))}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="inline-flex items-center gap-2">
                    <BedDouble className="size-4 text-primary" />
                    {day.sleepLocation ?? "Sleep location TBD"}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <CarFront className="size-4 text-primary" />
                    {day.driveInfo ?? "No drive info"}
                  </p>
                </div>

                <WeatherChip location={day.location} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
