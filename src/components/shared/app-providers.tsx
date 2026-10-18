"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

import { ConfirmProvider } from "@/components/ns/overlay";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        layout: { unsafe_disableDevelopmentModeWarnings: true },
        variables: {
          colorPrimary: "#111110",
          colorText: "#111110",
          colorTextSecondary: "#62625E",
          colorBackground: "#FFFFFF",
          colorInputBackground: "#F3F3F1",
          colorInputText: "#111110",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
          borderRadius: "14px",
        },
      }}
    >
      <ConfirmProvider>{children}</ConfirmProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#111110",
            color: "#fff",
            border: "none",
            borderRadius: "999px",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
          },
        }}
      />
    </ClerkProvider>
  );
}
