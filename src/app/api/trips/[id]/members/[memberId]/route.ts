import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  TRIP_MEMBER_ROLE_VALUES,
  removeTripMember,
  updateTripMemberRole,
} from "@/lib/trip-memberships";
import { requireRouteTripContext } from "@/lib/route-auth";

const updateMemberSchema = z.object({
  role: z.enum(TRIP_MEMBER_ROLE_VALUES),
});

function revalidateAppPaths() {
  revalidatePath("/app", "layout");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const context = await requireRouteTripContext({ minimumRole: "owner" });
  if ("error" in context) {
    return context.error;
  }

  const { id, memberId } = await params;
  const tripId = Number(id);
  const membershipId = Number(memberId);
  if (!Number.isFinite(tripId) || !Number.isFinite(membershipId)) {
    return NextResponse.json({ error: "Invalid member id." }, { status: 400 });
  }

  const payload = updateMemberSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "A valid role is required." }, { status: 400 });
  }

  try {
    const membership = await updateTripMemberRole({
      ownerUserId: context.appUser.id,
      tripId,
      membershipId,
      role: payload.data.role,
    });
    revalidateAppPaths();
    return NextResponse.json(membership);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update trip member." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const context = await requireRouteTripContext({ minimumRole: "owner" });
  if ("error" in context) {
    return context.error;
  }

  const { id, memberId } = await params;
  const tripId = Number(id);
  const membershipId = Number(memberId);
  if (!Number.isFinite(tripId) || !Number.isFinite(membershipId)) {
    return NextResponse.json({ error: "Invalid member id." }, { status: 400 });
  }

  try {
    await removeTripMember({
      ownerUserId: context.appUser.id,
      tripId,
      membershipId,
    });
    revalidateAppPaths();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove trip member." },
      { status: 400 }
    );
  }
}
