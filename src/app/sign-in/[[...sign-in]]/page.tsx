import { SignIn } from "@clerk/nextjs";

import { AuthShell, clerkAuthAppearance } from "@/components/auth/AuthShell";
import { getSafeRedirectPath } from "@/lib/start";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const redirectUrl = getSafeRedirectPath(redirect_url);

  return (
    <AuthShell title="Sign in">
      <SignIn
        appearance={clerkAuthAppearance}
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl={redirectUrl}
        signUpForceRedirectUrl={redirectUrl}
      />
    </AuthShell>
  );
}
