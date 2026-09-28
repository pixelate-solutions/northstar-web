import { NextResponse } from "next/server";

import { requireRouteTripContext } from "@/lib/route-auth";
import { getDashboardBundle } from "@/lib/server-data";
import { getTripExportFilename, renderTripExportHtml } from "@/lib/trip-export";

function parseTimeZone(value: string | null) {
  if (!value) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const context = await requireRouteTripContext();
  if ("error" in context) {
    return context.error;
  }

  const bundle = await getDashboardBundle(context.activeTrip.id);
  if (!bundle) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const timeZone = parseTimeZone(new URL(request.url).searchParams.get("tz"));
  const html = renderTripExportHtml(bundle, { timeZone });
  const filename = getTripExportFilename(bundle.trip.name);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
