import { NextResponse } from "next/server";

import { getLocations } from "@/lib/server-data";

export async function GET(request: Request) {
  const dayId = Number(new URL(request.url).searchParams.get("dayId"));
  const data = await getLocations(Number.isFinite(dayId) ? dayId : undefined);
  return NextResponse.json(data);
}
