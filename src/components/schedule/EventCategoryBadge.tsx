import { getCategoryConfig } from "@/lib/category-config";
import { cn } from "@/lib/utils";

export function EventCategoryBadge({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const config = getCategoryConfig(category);
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
        config.bgClass,
        config.borderClass,
        config.textClass,
        className
      )}
    >
      <Icon className="size-3.5" />
      {config.label}
    </span>
  );
}
