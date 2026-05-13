"use client";

import { startTransition, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DayAutofillButton({
  dayId,
  disabled = false,
}: {
  dayId: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function autofillDay() {
    setPending(true);
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayId, mode: "autofill" }),
    });
    const body = (await response.json().catch(() => null)) as
      | { addedEvents?: number; message?: string; error?: string }
      | null;
    setPending(false);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to auto-fill this day.");
      return;
    }

    toast.success(
      body?.message ?? `Auto-filled ${body?.addedEvents ?? 0} recommendation(s).`
    );
    startTransition(() => router.refresh());
  }

  return (
    <Button
      type="button"
      onClick={() => void autofillDay()}
      disabled={disabled || pending}
      variant="outline"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      Auto-fill day
    </Button>
  );
}
