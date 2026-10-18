import { redirect } from "next/navigation";

import { buildAuthHref } from "@/lib/start";
import { getAuthenticatedClerkUserId, getCurrentAppUser, isClerkConfigured } from "@/lib/auth";

export default async function StartPage() {
  if (!isClerkConfigured()) {
    redirect("/sign-up");
  }

  const clerkUserId = await getAuthenticatedClerkUserId();
  if (!clerkUserId) {
    redirect(buildAuthHref("/sign-up"));
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect(buildAuthHref("/sign-up"));
  }

  redirect("/app");
}
