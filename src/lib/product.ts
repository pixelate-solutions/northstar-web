export const product = {
  name: "Northstar",
  description:
    "Plan smarter trips with a structured itinerary builder that turns scattered travel ideas into a clear, organized plan.",
  shortDescription:
    "A clean travel planning workspace for building organized vacations from first idea to final itinerary.",
  priceLabel: "$49",
  priceDescription: "One-time purchase. Lifetime access to the core planning workspace.",
  stripeProductName: "Northstar Lifetime",
  supportEmail: "support@northstar.travel",
} as const;

export const landingFeatureHighlights = [
  {
    title: "Structured itinerary builder",
    description:
      "Organize every day, stop, activity, and note inside a single trip workspace.",
  },
  {
    title: "Day-by-day planning",
    description:
      "Map each travel day, keep key logistics visible, and make edits without losing the full picture.",
  },
  {
    title: "Activities, reminders, and budget",
    description:
      "Track bookings, checklists, expenses, and logistics next to the itinerary they belong to.",
  },
  {
    title: "Reusable trip templates",
    description:
      "Start with a proven outline, then customize it into a trip that matches your route and pace.",
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
      "Core planning is included for life. Optional AI features can be added later as a separate upgrade.",
  },
  {
    question: "Can I export my itinerary?",
    answer: "Yes. Export support is included in the paid core product.",
  },
] as const;
