import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Settings,
  UtensilsCrossed,
} from "lucide-react";

import { DayNotesEditor } from "@/components/dashboard/DayNotesEditor";
import { DaySchedule } from "@/components/schedule/DaySchedule";
import { PageHeader } from "@/components/shared/PageHeader";
import { WeatherChip } from "@/components/shared/WeatherChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/lib/metadata";
import { getCurrentTripContext } from "@/lib/auth";
import { getDayByDate, getDaysOverview, getPackingItems } from "@/lib/server-data";
import { ensureStarterTrip } from "@/lib/trips";
import { formatCurrency, formatDate, formatTimeRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const context = await getCurrentTripContext();
  if (!context) {
    return buildMetadata("Day Detail");
  }

  const trip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  const { date } = await params;
  const day = trip ? await getDayByDate(trip.id, date) : null;
  return buildMetadata(day ? day.title : "Day Detail");
}

export default async function DayDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const context = await getCurrentTripContext();
  if (!context) {
    return null;
  }

  const trip = context.activeTrip ?? (await ensureStarterTrip(context.appUser));
  if (!trip) {
    return null;
  }

  const { date } = await params;
  const [day, packingItems, allDays] = await Promise.all([
    getDayByDate(trip.id, date),
    getPackingItems(trip.id),
    getDaysOverview(trip.id),
  ]);

  if (!day) {
    const fallbackDay = allDays[0];
    if (fallbackDay) {
      redirect(`/app/days/${fallbackDay.date}`);
    }
    notFound();
  }

  const currentDayIndex = allDays.findIndex((item) => item.date === day.date);
  const previousDay = currentDayIndex > 0 ? allDays[currentDayIndex - 1] : null;
  const nextDay =
    currentDayIndex >= 0 && currentDayIndex < allDays.length - 1
      ? allDays[currentDayIndex + 1]
      : null;

  const foodEvents = day.events.filter((event) => event.category === "food");
  const dayPackingItems = packingItems.filter((item) => item.daySpecific === day.id);
  const totalEventCost = day.events.reduce(
    (sum, event) => sum + Number(event.cost ?? 0),
    0
  );

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    day.location
  )}`;
  const canEdit = (context.activeTripRole ?? trip.accessRole) !== "viewer";

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        eyebrow={`Day ${day.dayNumber}`}
        title={day.title}
        description={`${day.location} · ${day.sleepLocation ?? "Stay TBD"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/days">
              <Button variant="outline">
                <Settings className="size-4" />
                Configure
              </Button>
            </Link>
            {previousDay ? (
              <Link href={`/app/days/${previousDay.date}`}>
                <Button variant="outline">
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
              </Link>
            ) : (
              <Button variant="outline" disabled>
                <ChevronLeft className="size-4" />
                Previous
              </Button>
            )}
            {nextDay ? (
              <Link href={`/app/days/${nextDay.date}`}>
                <Button variant="outline">
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="outline" disabled>
                Next
                <ChevronRight className="size-4" />
              </Button>
            )}
            <WeatherChip location={day.location} />
          </div>
        }
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="min-w-0 space-y-6">
          <div className="min-w-0 rounded-[2rem] border border-border/70 bg-card/80 p-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="max-w-full h-auto whitespace-normal bg-secondary/70 text-foreground break-words [overflow-wrap:anywhere]">
                {formatDate(day.date)}
              </Badge>
              <Badge className="max-w-full h-auto whitespace-normal bg-secondary/70 text-foreground break-words [overflow-wrap:anywhere]">
                {day.sleepLocation ?? "Sleep TBD"}
              </Badge>
              {day.driveInfo ? (
                <Badge className="max-w-full h-auto whitespace-normal bg-secondary/70 text-foreground break-words [overflow-wrap:anywhere]">
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
            editable={canEdit}
            title="Sortable Schedule"
          />
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="min-w-0 rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Food Highlights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {foodEvents.length ? (
                foodEvents.map((event) => (
                  <div
                    key={event.id}
                    className="min-w-0 rounded-2xl border border-border/60 bg-secondary/40 p-4"
                  >
                    <p className="inline-flex min-w-0 items-center gap-2 break-words text-sm font-medium">
                      <UtensilsCrossed className="size-4 shrink-0 text-primary" />
                      {event.title}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatTimeRange(event.startTime, event.endTime)}
                    </p>
                    {event.location ? (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
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

          <Card className="min-w-0 rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Drive Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="break-words text-muted-foreground">
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

          <Card className="min-w-0 rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <DayNotesEditor date={day.date} initialNotes={day.notes} canEdit={canEdit} />
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-[2rem] border border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle>Day Packing List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayPackingItems.length ? (
                dayPackingItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-w-0 items-center justify-between rounded-2xl bg-secondary/40 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 break-words">{item.name}</span>
                    <Badge className="ml-2 shrink-0 bg-secondary text-foreground">{item.quantity}x</Badge>
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
