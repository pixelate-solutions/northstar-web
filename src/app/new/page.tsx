import { redirect } from "next/navigation";

import { NewTripForm } from "@/app/new/NewTripForm";
import { getAuthenticatedClerkUserId } from "@/lib/auth";

export default async function NewTripPage() {
  if (!(await getAuthenticatedClerkUserId())) redirect("/sign-in?redirect_url=/new");
  return <NewTripForm />;
}
