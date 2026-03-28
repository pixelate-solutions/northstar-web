import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  TRIP_MEMBER_ROLE_VALUES,
  addTripMemberByEmail,
  listTripMembersForOwner,
} from "@/lib/trip-memberships";
import { requireRouteTripContext } from "@/lib/route-auth";

const createMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(TRIP_MEMBER_ROLE_VALUES).optional(),
});

function revalidateAppPaths() {
  revalidatePath("/app", "layout");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireRouteTripContext({ minimumRole: "owner" });
  if ("error" in context) {
    return context.error;
  }

  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  try {
    const members = await listTripMembersForOwner(context.appUser.id, tripId);
    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load trip members." },
      { status: 403 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireRouteTripContext({ minimumRole: "owner" });
  if ("error" in context) {
    return context.error;
  }

  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  const payload = createMemberSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    await addTripMemberByEmail({
      ownerUserId: context.appUser.id,
      tripId,
      email: payload.data.email,
      role: payload.data.role,
    });
    revalidateAppPaths();
    const members = await listTripMembersForOwner(context.appUser.id, tripId);
    return NextResponse.json({ members }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to share this trip." },
      { status: 400 }
    );
  }
}
