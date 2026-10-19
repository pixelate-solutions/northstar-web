import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireRouteTripContext } from "@/lib/route-auth";

/**
 * A fingerprint of everything collaborators see on a trip (trip, days, stops, pins, lists, budget, members).
 * Clients poll it every few seconds and reload the trip when it changes, so edits show up live for everyone.
 */
export async function GET() {
  const context = await requireRouteTripContext();
  if ("error" in context) return context.error;
  const tripId = context.activeTrip.id;

  const result = await context.db.execute(sql`
    select md5(concat_ws('|',
      (select coalesce(string_agg(md5(t::text), ',' order by t.id), '') from trips t where t.id = ${tripId}),
      (select coalesce(string_agg(md5(d::text), ',' order by d.id), '') from days d where d.trip_id = ${tripId}),
      (select coalesce(string_agg(md5(e::text), ',' order by e.id), '') from events e join days d on d.id = e.day_id where d.trip_id = ${tripId}),
      (select coalesce(string_agg(md5(l::text), ',' order by l.id), '') from locations l join days d on d.id = l.day_id where d.trip_id = ${tripId}),
      (select coalesce(string_agg(md5(p::text), ',' order by p.id), '') from packing_items p where p.trip_id = ${tripId}),
      (select coalesce(string_agg(md5(x::text), ',' order by x.id), '') from expenses x where x.trip_id = ${tripId}),
      (select coalesce(string_agg(md5(r::text), ',' order by r.id), '') from reminders r where r.trip_id = ${tripId}),
      (select coalesce(string_agg(md5(m::text), ',' order by m.id), '') from trip_memberships m where m.trip_id = ${tripId})
    )) as version
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ version: string }>;
  return NextResponse.json(
    { tripId, version: rows[0]?.version ?? "" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
