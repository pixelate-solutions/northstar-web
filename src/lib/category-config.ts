import type { LucideIcon } from "lucide-react";
import {
  Mountain,
  UtensilsCrossed,
  Car,
  Plane,
  Camera,
  Building2,
  ShoppingBag,
  Music2,
  Circle,
} from "lucide-react";

export interface CategoryConfig {
  label: string;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  icon: LucideIcon;
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  hike: {
    label: "Hike",
    color: "#22c55e",
    bgClass: "bg-green-500/20",
    textClass: "text-green-400",
    borderClass: "border-green-500/30",
    dotClass: "bg-green-400",
    icon: Mountain,
  },
  food: {
    label: "Food",
    color: "#f97316",
    bgClass: "bg-orange-500/20",
    textClass: "text-orange-400",
    borderClass: "border-orange-500/30",
    dotClass: "bg-orange-400",
    icon: UtensilsCrossed,
  },
  drive: {
    label: "Drive",
    color: "#3b82f6",
    bgClass: "bg-blue-500/20",
    textClass: "text-blue-400",
    borderClass: "border-blue-500/30",
    dotClass: "bg-blue-400",
    icon: Car,
  },
  flight: {
    label: "Flight",
    color: "#a855f7",
    bgClass: "bg-purple-500/20",
    textClass: "text-purple-400",
    borderClass: "border-purple-500/30",
    dotClass: "bg-purple-400",
    icon: Plane,
  },
  sightseeing: {
    label: "Sightseeing",
    color: "#eab308",
    bgClass: "bg-yellow-500/20",
    textClass: "text-yellow-400",
    borderClass: "border-yellow-500/30",
    dotClass: "bg-yellow-400",
    icon: Camera,
  },
  accommodation: {
    label: "Accommodation",
    color: "#6366f1",
    bgClass: "bg-indigo-500/20",
    textClass: "text-indigo-400",
    borderClass: "border-indigo-500/30",
    dotClass: "bg-indigo-400",
    icon: Building2,
  },
  shopping: {
    label: "Shopping",
    color: "#ec4899",
    bgClass: "bg-pink-500/20",
    textClass: "text-pink-400",
    borderClass: "border-pink-500/30",
    dotClass: "bg-pink-400",
    icon: ShoppingBag,
  },
  entertainment: {
    label: "Entertainment",
    color: "#ef4444",
    bgClass: "bg-red-500/20",
    textClass: "text-red-400",
    borderClass: "border-red-500/30",
    dotClass: "bg-red-400",
    icon: Music2,
  },
  other: {
    label: "Other",
    color: "#64748b",
    bgClass: "bg-slate-500/20",
    textClass: "text-slate-400",
    borderClass: "border-slate-500/30",
    dotClass: "bg-slate-400",
    icon: Circle,
  },
};

export type Category = keyof typeof CATEGORY_CONFIG;

export const CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[];

export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other;
}
