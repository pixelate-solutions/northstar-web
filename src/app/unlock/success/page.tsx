import { redirect } from "next/navigation";

import { syncLifetimeAccessFromSessionId } from "@/lib/billing";

export default async function UnlockSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  if (sessionId) {
    try {
      await syncLifetimeAccessFromSessionId(sessionId);
    } catch {
      // The webhook remains the source of truth. This page only accelerates unlock.
    }
  }

  redirect("/app");
}
