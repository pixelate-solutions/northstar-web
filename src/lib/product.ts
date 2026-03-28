export const product = {
  name: "Northstar",
  description:
    "Plan smarter trips with an AI concierge that researches, organizes, and updates your itinerary inside one structured travel workspace.",
  shortDescription:
    "A clean travel planning workspace with an AI concierge for building organized vacations from first idea to final itinerary.",
  priceLabel: "$49",
  priceDescription: "One-time purchase. Lifetime access to the core planning workspace.",
  stripeProductName: "Northstar Lifetime",
  supportEmail: "support@northstar.travel",
} as const;

export const landingFeatureHighlights = [
  {
    title: "AI planning concierge",
    description:
      "Plan in natural language, research live options, and let Northstar update the active trip for you.",
  },
  {
    title: "Day-by-day planning",
    description:
      "Map each travel day, keep key logistics visible, and make edits without losing the full picture.",
  },
  {
    title: "Budget, packing, and reservations",
    description:
      "Track bookings, checklists, expenses, reservations, and logistics next to the itinerary they belong to.",
  },
  {
    title: "Booking assistance",
    description:
      "Compare options, sync reservations, and move into approval-based booking flows without leaving the app.",
  },
] as const;

export const landingWorkflow = [
  "Create a trip",
  "Add days",
  "Organize activities",
  "Track logistics",
  "Export your plan",
] as const;

export const landingFaqs = [
  {
    question: "Can I create multiple trips?",
    answer: "Yes. Every account can create and manage multiple private trips.",
  },
  {
    question: "Is this a subscription?",
    answer:
      "No. Northstar's core planning workspace is a one-time $49 purchase for lifetime access.",
  },
  {
    question: "Will AI features be included?",
    answer:
      "Yes. Northstar AI is built into the planning workspace for natural-language trip edits, research, budgets, packing help, reservation sync, and booking assistance.",
  },
  {
    question: "Can I export my itinerary?",
    answer: "Yes. Export support is included in the paid core product.",
  },
] as const;
