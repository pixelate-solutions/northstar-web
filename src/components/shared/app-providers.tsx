"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const clerkReady = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_placeholder"
  );

  return (
    <>
      {clerkReady ? <ClerkProvider>{children}</ClerkProvider> : children}
      <Toaster richColors position="top-right" />
    </>
  );
}
