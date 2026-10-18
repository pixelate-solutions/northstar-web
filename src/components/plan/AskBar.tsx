"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";

import { StarMark } from "@/components/brand/Logo";
import { useTrip } from "@/components/trip/TripProvider";

/** Pinned "Ask Northstar" input at the bottom of the Plan column (desktop). */
export function AskBar() {
  const { openAsk, canEdit } = useTrip();
  const [text, setText] = useState("");
  if (!canEdit) return null;
  return (
    <form
      className="hidden shrink-0 px-6 pb-6 pt-4 lg:flex"
      onSubmit={(event) => {
        event.preventDefault();
        openAsk(text.trim() || undefined, Boolean(text.trim()));
        setText("");
      }}
    >
      <div className="flex h-14 flex-1 items-center gap-3 rounded-full bg-ink pl-[18px] pr-2">
        <StarMark size={18} color="#FFC500" core={null} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask Northstar"
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-white placeholder:text-[#A3A39E]"
        />
        <button type="submit" aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-full bg-lane">
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </div>
    </form>
  );
}
