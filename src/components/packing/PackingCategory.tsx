import { PackageCheck } from "lucide-react";

import { PackingItem } from "@/components/packing/PackingItem";
import { PackingProgress } from "@/components/packing/PackingProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PackingItem as PackingItemType } from "@/db/schema";

interface PackingCategoryProps {
  category: string;
  items: PackingItemType[];
  onToggle: (item: PackingItemType) => void;
  onEdit: (item: PackingItemType) => void;
  onDelete: (item: PackingItemType) => void;
  onPackAll: () => void;
}

export function PackingCategory({
  category,
  items,
  onToggle,
  onEdit,
  onDelete,
  onPackAll,
}: PackingCategoryProps) {
  const packed = items.filter((item) => Boolean(item.isPacked)).length;

  return (
    <Card className="rounded-[2rem] border border-border/70 bg-card/80">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="capitalize">{category}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} items in this category
          </p>
        </div>
        <Button variant="outline" onClick={onPackAll}>
          <PackageCheck className="size-4" />
          Pack All
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <PackingProgress packed={packed} total={items.length} />
        <div className="space-y-3">
          {items.map((item) => (
            <PackingItem
              key={item.id}
              item={item}
              onToggle={() => onToggle(item)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
