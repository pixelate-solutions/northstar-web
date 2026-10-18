import { BedDouble, Car, Eye, MapPin, Mountain, Plane, ShoppingBag, Ticket, UtensilsCrossed, type LucideIcon } from "lucide-react";

export const CATEGORY_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "sightseeing", label: "View", icon: Eye },
  { value: "food", label: "Food", icon: UtensilsCrossed },
  { value: "hike", label: "Hike", icon: Mountain },
  { value: "accommodation", label: "Stay", icon: BedDouble },
  { value: "drive", label: "Drive", icon: Car },
  { value: "flight", label: "Flight", icon: Plane },
  { value: "shopping", label: "Shop", icon: ShoppingBag },
  { value: "entertainment", label: "Fun", icon: Ticket },
  { value: "other", label: "Other", icon: MapPin },
];

export function categoryMeta(value: string | null | undefined) {
  return CATEGORY_OPTIONS.find((option) => option.value === value) ?? CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
}

export function CategoryPill({ category, className = "" }: { category: string; className?: string }) {
  const meta = categoryMeta(category);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold ${className}`}>
      <Icon size={13} strokeWidth={2.2} />
      {meta.label}
    </span>
  );
}
