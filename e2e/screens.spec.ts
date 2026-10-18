import { test } from "@playwright/test";

import { signIn } from "./helpers";

// Visual pass over every screen; screenshots land in test-results/screens.
test("screens", async ({ page }, info) => {
  const shot = (name: string) => page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  await page.goto("/");
  await shot("landing");
  await page.goto("/sign-in");
  await page.waitForTimeout(1500);
  await shot("sign-in");
  await signIn(page);
  await page.waitForTimeout(2500);
  await shot("plan-trip");
  const firstDay = page.locator("a[href^='/app/days/']:visible").nth(2);
  await firstDay.click();
  await page.waitForTimeout(2500);
  await shot("plan-day");
  await page.goto("/app/lists");
  await page.waitForTimeout(800);
  await shot("lists");
  await page.goto("/app/budget");
  await page.waitForTimeout(800);
  await shot("budget");
  await page.goto("/new");
  await page.waitForTimeout(800);
  await shot("new");
});
