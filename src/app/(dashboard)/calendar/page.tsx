import { TripCalendar } from "@/components/calendar/TripCalendar";
import { TripMap } from "@/components/map/TripMap";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildMetadata } from "@/lib/metadata";
import { getDaysOverview } from "@/lib/server-data";

export const metadata = buildMetadata("Trip");
export const dynamic = "force-dynamic";

export default async function DaysPage() {
  const days = await getDaysOverview();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Trip Planning"
        title="Trip"
        description="View the full route on the map or browse the itinerary by calendar."
      />
      <Tabs defaultValue="map" className="flex-col gap-5">
        <div className="w-full rounded-[1.75rem] border border-white/40 bg-white/32 p-2 shadow-[0_18px_42px_rgba(191,102,62,0.08)] backdrop-blur-xl">
          <TabsList className="grid w-full grid-cols-2 gap-2 rounded-[1.25rem] bg-transparent p-0">
            <TabsTrigger
              value="map"
              className="min-h-5 rounded-[1rem] border border-transparent bg-white/10 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-white/50 hover:text-foreground after:hidden aria-selected:border-white/55 aria-selected:bg-white/80 aria-selected:text-foreground aria-selected:shadow-[0_10px_24px_rgba(191,102,62,0.08)]"
            >
              Map
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="min-h-5 rounded-[1rem] border border-transparent bg-white/10 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-white/50 hover:text-foreground after:hidden aria-selected:border-white/55 aria-selected:bg-white/80 aria-selected:text-foreground aria-selected:shadow-[0_10px_24px_rgba(191,102,62,0.08)]"
            >
              Calendar
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="map" className="w-full">
          <TripMap days={days} />
        </TabsContent>
        <TabsContent value="calendar" className="w-full">
          <TripCalendar days={days} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
