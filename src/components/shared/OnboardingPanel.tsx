"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function OnboardingPanel({ tripName }: { tripName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function finishOnboarding() {
    setLoading(true);
    const response = await fetch("/api/onboarding/complete", { method: "POST" });
    setLoading(false);

    if (!response.ok) {
      toast.error("Unable to update onboarding.");
      return;
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
              Your blank trip is ready for planning.
            </h2>
            <p className="max-w-2xl text-sm text-white/78 sm:text-base">
              We created <span className="font-medium text-white">{tripName}</span> as a fresh
              blank trip so you can start building your itinerary from scratch.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            className="h-12 justify-between rounded-2xl bg-white text-slate-900 hover:bg-white/90"
            onClick={finishOnboarding}
            disabled={loading}
          >
            Start planning
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
