import type { Metadata } from "next";

export function buildMetadata(pageName: string): Metadata {
  return {
    title: `SW Road Trip '26 | ${pageName}`,
    description:
      "A mobile-first Southwest road trip planner for April 8–18, 2026.",
  };
}
