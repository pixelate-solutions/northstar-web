import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.skip(({ isMobile }) => !isMobile, "Mobile-only flows.");

test("mobile: day strip, add a stop, lists tabs, Ask sheet", async ({ page }) => {
  await signIn(page);
  const me = await (await page.request.get("/api/me")).json();
  const owned = me.trips.find((t: { role: string }) => t.role !== "viewer");
  const trip = await (await page.request.get(`/api/trip?tripId=${owned.id}`)).json();
  await page.goto("/app");

  // Day strip navigates between days.
  await page.getByRole("link", { name: String(trip.days[1].dayNumber), exact: true }).click();
  await page.waitForURL(`**/app/days/${trip.days[1].date}`);
  await expect(page.getByText(`Day ${trip.days[1].dayNumber} ·`, { exact: false })).toBeVisible();

  // Add a stop on mobile.
  const title = `Mobile E2E ${Date.now().toString().slice(-5)}`;
  await page.getByRole("button", { name: "Add a stop" }).click();
  await page.getByLabel("New stop", { exact: true }).fill(title);
  await page.getByLabel("New stop", { exact: true }).press("Enter");
  await expect(page.getByLabel("Stop name")).toHaveValue(title);
  await page.getByRole("button", { name: "Done" }).click();
  const created = (await (await page.request.get("/api/trip")).json()).days[1].events.find((e: { title: string }) => e.title === title);
  expect(created).toBeTruthy();
  expect(created.startTime, "stops added without a time get the current time").not.toBeNull();
  await page.request.delete(`/api/events/${created.id}`);

  // Bottom tabs + Lists segmented control.
  await page.getByRole("link", { name: "Lists" }).click();
  await page.waitForURL("**/app/lists");
  await page.getByRole("button", { name: /Packing/ }).click();
  await expect(page.getByPlaceholder("Add an item")).toBeVisible();
  await page.getByRole("link", { name: "Budget" }).click();
  await expect(page.getByText("Trip total")).toBeVisible();

  // Ask opens full screen and closes.
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText("What should we change?")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("What should we change?")).toHaveCount(0);
});
