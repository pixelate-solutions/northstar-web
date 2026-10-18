import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";

export async function signIn(page: Page) {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    // +clerk_test addresses verify with Clerk's fixed test code, which also satisfies new-device checks.
    signInParams: { strategy: "email_code", identifier: process.env.E2E_CLERK_USER_EMAIL! },
  });
  await page.goto("/app");
  await page.waitForURL(/\/app/);
}
