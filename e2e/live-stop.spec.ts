import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

// Helper for the iOS live-update test: acts as a collaborator by adding a stop through the API while the app is
// open, then removes it. Only runs when LIVE_STOP is set.
test.skip(!process.env.LIVE_STOP, "Set LIVE_STOP to run");
test.skip(({ isMobile }) => isMobile, "desktop only");
test.setTimeout(150_000);

test("collaborator adds a stop", async ({ page }) => {
  await signIn(page);
  const trip = await (await page.request.get("/api/trip")).json();
  const day = trip.days[0];
  const created = await (
    await page.request.post("/api/events", {
      data: { dayId: day.id, title: process.env.LIVE_STOP, startTime: "12:00", category: "food" },
      headers: { "x-trip-id": String(trip.trip.id) },
    })
  ).json();
  expect(created.id).toBeTruthy();
  await page.waitForTimeout(60_000); // the iOS test is watching for it meanwhile
  await page.request.delete(`/api/events/${created.id}`, { headers: { "x-trip-id": String(trip.trip.id) } });
});
