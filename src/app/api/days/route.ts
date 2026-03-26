import { NextResponse } from "next/server";

import { getDaysOverview } from "@/lib/server-data";

export async function GET() {
  const data = await getDaysOverview();
  return NextResponse.json(data);
}
