import type { Metadata } from "next";

import { product } from "@/lib/product";

export function buildMetadata(pageName?: string): Metadata {
  const title = pageName ? `${product.name} | ${pageName}` : product.name;

  return {
    title,
    description: product.description,
  };
}
