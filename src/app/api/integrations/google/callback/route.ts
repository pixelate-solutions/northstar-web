import { NextResponse } from "next/server";

import {
  connectGoogleAccountFromCode,
  decodeGoogleState,
  isGoogleConfigured,
} from "@/lib/ai/integrations/google";
import { getCurrentAppUser } from "@/lib/auth";

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google integration is not configured." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = decodeGoogleState(url.searchParams.get("state"));

  if (!code || !state?.userId || !state.tripId) {
    return NextResponse.json({ error: "Invalid Google callback." }, { status: 400 });
  }

  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.id !== state.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  await connectGoogleAccountFromCode({
    userId: state.userId,
    tripId: state.tripId,
    code,
  });

  return NextResponse.redirect(new URL(state.returnTo || "/app", url.origin));
}
