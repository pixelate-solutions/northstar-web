import { getCategoryConfig } from "@/lib/category-config";

export function CalendarEventItem({ category, title }: { category: string; title: string }) {
  const config = getCategoryConfig(category);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-1.5 truncate text-[11px] font-semibold text-white">
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{title}</span>
    </div>
  );
}
