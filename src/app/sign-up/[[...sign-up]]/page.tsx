import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/auth";
import { product } from "@/lib/product";
import { buildAuthHref, getSafeRedirectPath } from "@/lib/start";

const authAppearance = {
  elements: {
    rootBox: "w-full max-w-full",
    cardBox: "w-full max-w-full",
    card:
      "w-full max-w-full rounded-[1.5rem] border border-slate-200/70 bg-white/95 p-4 text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-6",
    footer:
      "mt-3 w-full rounded-[1.5rem] border border-slate-200/70 bg-white/95 px-4 py-4 text-slate-600 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:px-6",
    footerAction: "flex-wrap justify-center gap-1 text-center",
    formFieldInput: "w-full max-w-full",
    formButtonPrimary: "w-full",
    socialButtonsBlockButton: "w-full max-w-full",
    identityPreviewText: "break-all",
  },
} as const;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url: redirectUrlParam } = await searchParams;
  const redirectUrl = getSafeRedirectPath(redirectUrlParam);

  if (!isClerkConfigured()) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-start px-4 py-6 sm:items-center sm:px-6 sm:py-16">
        <div className="w-full rounded-[2rem] border border-border/70 bg-card/90 p-6 sm:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-primary/80">Auth Setup</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Add Clerk keys to continue</h1>
          <p className="mt-4 text-muted-foreground">
            Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
            <code>CLERK_SECRET_KEY</code> before using authentication flows for {product.name}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-start px-4 py-4 sm:items-center sm:px-6 sm:py-12">
      <div className="grid w-full gap-4 sm:gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
        <div className="min-w-0 rounded-[2rem] border border-white/65 bg-white/82 p-5 shadow-[0_30px_90px_rgba(17,46,72,0.10)] backdrop-blur-xl sm:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-primary/80">Start Here</p>
          <h1 className="mt-3 text-[1.75rem] font-semibold tracking-tight text-slate-950 sm:mt-4 sm:text-4xl">
            Create your {product.name} account.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:mt-5 sm:text-base sm:leading-8">
            Sign up first, then unlock lifetime access with a one-time payment. After that,
            your planning workspace stays yours.
          </p>
          <Link href="/" className="mt-8 inline-flex text-sm text-slate-600 underline-offset-4 hover:underline">
            Return to landing page
          </Link>
        </div>
        <div className="min-w-0 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(17,65,102,0.98),rgba(21,117,132,0.88))] p-3 text-white shadow-[0_30px_90px_rgba(17,46,72,0.18)] sm:p-6">
          <SignUp
            path="/sign-up"
            routing="path"
            signInUrl={buildAuthHref("/sign-in", redirectUrl)}
            forceRedirectUrl={redirectUrl}
            fallbackRedirectUrl={redirectUrl}
            appearance={authAppearance}
          />
        </div>
      </div>
    </div>
  );
}
