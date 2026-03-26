"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DayNotesEditor({
  date,
  initialNotes,
}: {
  date: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function saveNotes() {
    setSaving(true);
    const response = await fetch(`/api/days/${date}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes }),
    });

    setSaving(false);

    if (!response.ok) {
      toast.error("Unable to save day notes.");
      return;
    }

    toast.success("Notes saved.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={6}
        aria-label="Day notes"
        placeholder="Add notes, reservations, or anything you want to remember for this day."
      />
      <Button onClick={() => void saveNotes()} disabled={saving}>
        {saving ? "Saving..." : "Save Notes"}
      </Button>
    </div>
  );
}
