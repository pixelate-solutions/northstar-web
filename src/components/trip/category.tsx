import { BedDouble, Car, Eye, MapPin, Mountain, Plane, ShoppingBag, Ticket, UtensilsCrossed, type LucideIcon } from "lucide-react";

export const CATEGORY_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon; color: string }> = [
  { value: "sightseeing", label: "View", icon: Eye, color: "#2E70DB" },
  { value: "food", label: "Food", icon: UtensilsCrossed, color: "#E3590D" },
  { value: "hike", label: "Hike", icon: Mountain, color: "#2B8A3D" },
  { value: "accommodation", label: "Stay", icon: BedDouble, color: "#6640D9" },
  { value: "drive", label: "Drive", icon: Car, color: "#4A4F57" },
  { value: "flight", label: "Flight", icon: Plane, color: "#1C7DD6" },
  { value: "shopping", label: "Shop", icon: ShoppingBag, color: "#D6336B" },
  { value: "entertainment", label: "Fun", icon: Ticket, color: "#C27A00" },
  { value: "other", label: "Other", icon: MapPin, color: "#878F97" },
];

export function categoryMeta(value: string | null | undefined) {
  return CATEGORY_OPTIONS.find((option) => option.value === value) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
}

export function CategoryPill({ category, className = "" }: { category: string; className?: string }) {
  const meta = categoryMeta(category);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${className}`}
      style={{ color: meta.color, background: `${meta.color}1F` }}
    >
      <Icon size={13} strokeWidth={2.2} />
      {meta.label}
    </span>
  );
}
