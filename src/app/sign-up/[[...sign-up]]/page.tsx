import { SignUp } from "@clerk/nextjs";

import { AuthShell, clerkAuthAppearance } from "@/components/auth/AuthShell";
import { getSafeRedirectPath } from "@/lib/start";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const redirectUrl = getSafeRedirectPath(redirect_url);

  return (
    <AuthShell title="Create account">
      <SignUp
        appearance={clerkAuthAppearance}
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl={redirectUrl}
        signInForceRedirectUrl={redirectUrl}
      />
    </AuthShell>
  );
}
