"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Map, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function OnboardingPanel({ tripName }: { tripName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"complete" | "blank" | null>(null);

  async function finishOnboarding() {
    setLoading("complete");
    const response = await fetch("/api/onboarding/complete", { method: "POST" });
    setLoading(null);

    if (!response.ok) {
      toast.error("Unable to update onboarding.");
      return;
    }

    router.refresh();
  }

  async function createBlankTrip() {
    setLoading("blank");
    const response = await fetch("/api/trips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "My Next Trip",
        totalDays: 7,
        importTemplate: false,
      }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(null);

    if (!response.ok) {
      toast.error(body?.error ?? "Unable to create a blank trip.");
      return;
    }

    const done = await fetch("/api/onboarding/complete", { method: "POST" });
    if (!done.ok) {
      toast.error("Trip created, but onboarding could not be completed.");
    }

    router.refresh();
  }

  return (
    <Card className="overflow-hidden rounded-[2rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(17,65,102,0.96),rgba(21,117,132,0.86))] text-white shadow-[0_28px_90px_rgba(17,65,102,0.22)]">
      <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/80">
            <Sparkles className="size-3.5" />
            Welcome
          </p>
          <div className="space-y-3">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">
              Your workspace is ready. Start with the imported template or spin up a blank trip.
            </h2>
            <p className="max-w-2xl text-sm text-white/78 sm:text-base">
              The current Southwest itinerary has already been copied into your account as{" "}
              <span className="font-medium text-white">{tripName}</span>. You can keep it,
              edit it, or create a fresh trip from scratch.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Button
            variant="secondary"
            className="h-12 justify-between rounded-2xl bg-white text-slate-900 hover:bg-white/90"
            onClick={finishOnboarding}
            disabled={loading !== null}
          >
            Open imported trip
            <ArrowRight className="size-4" />
          </Button>
          <Button
            className="h-12 justify-between rounded-2xl border border-white/25 bg-white/12 text-white hover:bg-white/18"
            onClick={createBlankTrip}
            disabled={loading !== null}
          >
            Create blank trip
            <Map className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
