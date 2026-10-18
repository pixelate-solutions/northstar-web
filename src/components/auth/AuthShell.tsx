import Link from "next/link";

import { Wordmark } from "@/components/brand/Logo";

export const clerkAuthAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-0 rounded-none",
    card: "w-full bg-transparent shadow-none border-0 p-0 gap-5",
    header: "hidden",
    socialButtonsBlockButton:
      "h-[52px] rounded-full border border-line bg-white text-[16px] font-semibold text-ink shadow-none hover:bg-surface",
    socialButtonsBlockButtonText: "text-[16px] font-semibold",
    dividerLine: "bg-line",
    dividerText: "text-[13px] text-muted",
    formFieldLabel: "text-[13px] font-semibold text-ink",
    formFieldInput:
      "h-[52px] rounded-full border-0 bg-surface px-5 text-[16px] text-ink shadow-none focus:ring-2 focus:ring-ink",
    formButtonPrimary:
      "h-[52px] rounded-full bg-ink text-[16px] font-bold normal-case text-white shadow-none hover:bg-ink/90",
    footer: "bg-transparent bg-none p-0 shadow-none",
    footerAction: "justify-center pt-2",
    footerActionText: "text-[15px] text-muted",
    footerActionLink: "text-[15px] font-bold text-ink underline underline-offset-2 hover:text-ink",
    footerPages: "hidden",
    identityPreview: "rounded-full bg-surface border-0",
    otpCodeFieldInput: "rounded-xl border-line",
    formResendCodeLink: "text-ink font-semibold",
  },
} as const;

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <nav className="px-5 pt-5 sm:px-14 sm:pt-7">
        <Link href="/">
          <Wordmark />
        </Link>
      </nav>
      <div className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="flex w-full max-w-[380px] flex-col">
          <h1 className="pb-8 text-[44px] font-extrabold leading-[46px] tracking-display sm:text-[48px] sm:leading-[52px]">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </main>
  );
}
