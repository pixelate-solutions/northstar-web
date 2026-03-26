import Image from "next/image";
import Link from "next/link";
import { BedDouble, CarFront } from "lucide-react";

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
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
                <div className="absolute left-5 top-5">
                  <Badge className="border-primary/30 bg-primary/10 text-primary">
                    Day {day.dayNumber}
                  </Badge>
                </div>
              </div>
              <CardContent className="space-y-4 py-5">
                <div>
                  <h2 className="text-xl font-semibold">{day.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateMedium(day.date)} · {day.location}
                  </p>
                </div>

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
