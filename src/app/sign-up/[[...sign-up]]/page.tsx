import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/auth";
import { product } from "@/lib/product";
import { buildAuthHref, getSafeRedirectPath } from "@/lib/start";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url: redirectUrlParam } = await searchParams;
  const redirectUrl = getSafeRedirectPath(redirectUrlParam);

  if (!isClerkConfigured()) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <div className="w-full rounded-[2rem] border border-border/70 bg-card/90 p-10">
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
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
      <div className="grid w-full gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/65 bg-white/82 p-10 shadow-[0_30px_90px_rgba(17,46,72,0.10)] backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.32em] text-primary/80">Start Here</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            Create your {product.name} account.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
            Sign up first, then unlock lifetime access with a one-time payment. After that,
            your planning workspace stays yours.
          </p>
          <Link href="/" className="mt-8 inline-flex text-sm text-slate-600 underline-offset-4 hover:underline">
            Return to landing page
          </Link>
        </div>
        <div className="flex items-center justify-center rounded-[2rem] bg-[linear-gradient(135deg,rgba(17,65,102,0.98),rgba(21,117,132,0.88))] p-6 text-white shadow-[0_30px_90px_rgba(17,46,72,0.18)]">
          <SignUp
            path="/sign-up"
            routing="path"
            signInUrl={buildAuthHref("/sign-in", redirectUrl)}
            forceRedirectUrl={redirectUrl}
            fallbackRedirectUrl={redirectUrl}
          />
        </div>
      </div>
    </div>
  );
}
