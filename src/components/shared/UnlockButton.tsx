"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function UnlockButton() {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);

    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    setLoading(false);

    if (!response.ok || !body?.url) {
      toast.error(body?.error ?? "Unable to start checkout.");
      return;
    }

    window.location.href = body.url;
  }

  return (
    <Button
      className="h-12 rounded-2xl px-5"
      onClick={handleCheckout}
      disabled={loading}
    >
      {loading ? "Redirecting..." : "Unlock Lifetime Access"}
      <ArrowRight className="size-4" />
    </Button>
  );
}
