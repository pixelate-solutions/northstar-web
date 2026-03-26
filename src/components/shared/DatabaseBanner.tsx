import { AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function DatabaseBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <Card className="border border-amber-500/20 bg-amber-500/10 text-amber-900">
      <CardContent className="flex items-start gap-3 py-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}
