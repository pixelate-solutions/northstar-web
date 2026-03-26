import nextDynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, UtensilsCrossed } from "lucide-react";

import { DayNotesEditor } from "@/components/dashboard/DayNotesEditor";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { PageHeader } from "@/components/shared/PageHeader";
import { WeatherChip } from "@/components/shared/WeatherChip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/lib/metadata";
import { getDayByDate, getPackingItems } from "@/lib/server-data";
import { formatCurrency, formatDate, formatTimeRange } from "@/lib/utils";

const DayMap = nextDynamic(
  () => import("@/components/map/DayMap").then((mod) => mod.DayMap),
  { ssr: false }
);

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { date: string };
}) {
  const day = await getDayByDate(params.date);
  return buildMetadata(day ? day.title : "Day Detail");
}

export default async function DayDetailPage({
  params,
}: {
  params: { date: string };
}) {
  const [day, packingItems] = await Promise.all([
    getDayByDate(params.date),
    getPackingItems(),
  ]);

  if (!day) notFound();

  const foodEvents = day.events.filter((event) => event.category === "food");
  const dayPackingItems = packingItems.filter(
    (item) => item.daySpecific === day.id
  );
  const totalEventCost = day.events.reduce(
    (sum, event) => sum + Number(event.cost ?? 0),
    0
  );

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    day.location
  )}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Day ${day.dayNumber}`}
        title={day.title}
        description={`${day.location} · ${day.sleepLocation ?? "Stay TBD"}`}
        actions={<WeatherChip location={day.location} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-secondary/70 text-foreground">{formatDate(day.date)}</Badge>
              <Badge className="bg-secondary/70 text-foreground">
                {day.sleepLocation ?? "Sleep TBD"}
              </Badge>
              {day.driveInfo ? (
                <Badge className="bg-secondary/70 text-foreground">
                  {day.driveInfo}
                </Badge>
              ) : null}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Card className="rounded-[1.5rem] border border-border/70 bg-secondary/40">
                <CardContent className="py-5">
                  <p className="text-sm text-muted-foreground">Events</p>
                  <p className="mt-2 text-3xl font-semibold">{day.events.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-[1.5rem] border border-border/70 bg-secondary/40">
                <CardContent className="py-5">
                  <p className="text-sm text-muted-foreground">Locations</p>
                  <p className="mt-2 text-3xl font-semibold">{day.locations.length}</p>
                </CardContent>
              </Card>
              <Card className="rounded-[1.5rem] border border-border/70 bg-secondary/40">
                <CardContent className="py-5">
                  <p className="text-sm text-muted-foreground">Estimated Cost</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {formatCurrency(totalEventCost)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <DaySchedule
            dayId={day.id}
            date={day.date}
            events={day.events}
            sortable
            title="Sortable Schedule"
          />

          <Card className="rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Day Map</CardTitle>
            </CardHeader>
            <CardContent>
              <DayMap locations={day.locations} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Food Highlights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {foodEvents.length ? (
                foodEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-border/60 bg-secondary/40 p-4"
                  >
                    <p className="inline-flex items-center gap-2 text-sm font-medium">
                      <UtensilsCrossed className="size-4 text-primary" />
                      {event.title}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatTimeRange(event.startTime, event.endTime)}
                    </p>
                    {event.location ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.location}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No food events have been added for this day yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Drive Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {day.driveInfo ?? "No drive summary is available for this day."}
              </p>
              <Link
                href={directionsUrl}
                target="_blank"
                className="inline-flex items-center gap-2 font-medium text-primary"
              >
                Open in Google Maps
                <ExternalLink className="size-4" />
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <DayNotesEditor date={day.date} initialNotes={day.notes} />
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Day Packing List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayPackingItems.length ? (
                dayPackingItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl bg-secondary/40 px-4 py-3 text-sm"
                  >
                    <span>{item.name}</span>
                    <Badge className="bg-secondary text-foreground">
                      {item.quantity}x
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No day-specific packing items are assigned yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
