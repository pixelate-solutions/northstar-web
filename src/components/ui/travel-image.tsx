"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { resolveTravelImageUrl, travelImageFor } from "@/lib/travel-images";
import { cn } from "@/lib/utils";

export function TravelImage({
  src,
  alt,
  className,
  fallbackClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const imageSrc = failed ? travelImageFor(alt) : resolveTravelImageUrl(src, alt);

  if (!imageSrc) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-secondary text-muted-foreground",
          fallbackClassName
        )}
      >
        <ImageIcon className="size-5" aria-hidden="true" />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
