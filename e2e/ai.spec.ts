import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.skip(({ isMobile }) => isMobile, "AI flow is covered once on desktop.");
test.setTimeout(240_000);

test("Ask Northstar edits the plan and Undo reverts it", async ({ page }) => {
  await signIn(page);
  // Use the trip with the most located stops so "near the first stop" is answerable.
  const me = await (await page.request.get("/api/me")).json();
  let trip = null;
  let best = -1;
  for (const candidate of me.trips) {
    const data = await (await page.request.get(`/api/trip?tripId=${candidate.id}`)).json();
    const located = data.days[1]?.events.filter((e: { lat: string | null }) => e.lat).length ?? 0;
    if (located > best && data.role !== "viewer") {
      best = located;
      trip = data;
    }
  }
  await page.request.get(`/api/trip?tripId=${trip.trip.id}`);
  const day = trip.days[1];
  const title = `E2E Coffee ${Date.now().toString().slice(-5)}`;

  await page.goto(`/app/days/${day.date}`);
  await page.getByPlaceholder("Ask Northstar").first().fill(
    `Add one stop to Day ${day.dayNumber} called "${title}" at 7:15 AM at a real coffee shop near the day's first stop. Don't change anything else.`
  );
  await page.getByPlaceholder("Ask Northstar").first().press("Enter");

  // Panel replaces the map, shows progress, then a change list.
  await expect(page.getByText("Ask Northstar", { exact: true })).toBeVisible();
  await expect(page.getByText(/change(s)?$/).first()).toBeVisible({ timeout: 200_000 });

  const after = await (await page.request.get("/api/trip")).json();
  const added = after.days.find((d: { id: number }) => d.id === day.id).events.find((e: { title: string }) => e.title.includes(title));
  expect(added, "AI should have created the stop").toBeTruthy();
  expect(added.startTime).toBe("07:15:00");
  expect(added.lat).not.toBeNull();

  // The changed stop is highlighted in the day list.
  await page.getByRole("button", { name: "Map" }).click();
  await expect(page.getByText(added.title)).toBeVisible();

  // Undo from the panel.
  await page.getByRole("button", { name: "Send" }).first().click(); // empty send reopens the panel
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Undone").first()).toBeVisible();
  const reverted = await (await page.request.get("/api/trip")).json();
  expect(reverted.days.find((d: { id: number }) => d.id === day.id).events.some((e: { title: string }) => e.title.includes(title))).toBe(false);
});
