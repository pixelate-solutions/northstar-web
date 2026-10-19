import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./helpers";

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Interaction suite runs on desktop; mobile has its own spec.");

const stamp = Date.now().toString().slice(-6);

async function bundle(page: Page) {
  const response = await page.request.get("/api/trip");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function openDay(page: Page, index: number) {
  await page.goto("/app");
  const link = page.locator("aside a[href^='/app/days/']").nth(index);
  const href = await link.getAttribute("href");
  await link.click();
  await page.waitForURL(`**${href}`);
  return href!.split("/").pop()!;
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("add, edit, move, and delete a stop", async ({ page }) => {
  const date = await openDay(page, 1);
  const title = `E2E dinner ${stamp}`;

  // Add with a leading time.
  await page.getByRole("button", { name: "Add a stop" }).click();
  await page.getByLabel("New stop").fill(`7:30p ${title}`);
  await page.getByLabel("New stop").press("Enter");
  await expect(page.getByLabel("Stop name")).toHaveValue(title); // editor opens on the new stop

  // Edit fields inline.
  await page.getByLabel("Notes").fill("Window table, conf #E2E");
  await page.getByRole("button", { name: "Mark booked" }).click();
  await page.getByLabel("Cost").fill("64");
  await page.getByLabel("Stop name").fill(`${title} (edited)`);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(`${title} (edited)`)).toBeVisible();
  // 12-hour time by default.
  await expect(page.getByRole("button", { name: new RegExp(`7:30 PM.*${title}`) })).toBeVisible();

  await expect
    .poll(async () => {
      const data = await bundle(page);
      const day = data.days.find((d: { date: string }) => d.date === date);
      const event = day.events.find((e: { title: string }) => e.title === `${title} (edited)`);
      return event && { ...event, cost: Number(event.cost) };
    })
    .toMatchObject({ startTime: "19:30:00", tip: "Window table, conf #E2E", isBooked: true, cost: 64 });

  // Persisted across reload.
  await page.reload();
  await expect(page.getByText(`${title} (edited)`)).toBeVisible();

  // Move to the next day.
  await page.getByText(`${title} (edited)`).click();
  await page.getByRole("button", { name: "Move to another day" }).click();
  await page.locator("[class*='shadow-pop'] button").nth(2).click();
  await expect(page.getByText(`${title} (edited)`)).toHaveCount(0);
  await expect
    .poll(async () => {
      const data = await bundle(page);
      return data.days.find((d: { events: Array<{ title: string }> }) => d.events.some((e) => e.title === `${title} (edited)`))?.date;
    })
    .not.toBe(date);

  // Delete it from its new day.
  const data = await bundle(page);
  const newDay = data.days.find((d: { events: Array<{ title: string }> }) => d.events.some((e) => e.title === `${title} (edited)`));
  await page.goto(`/app/days/${newDay.date}`);
  await page.getByText(`${title} (edited)`).click();
  // Delete asks first; cancelling keeps the stop.
  await page.getByRole("button", { name: /^Delete$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Stop name")).toHaveValue(`${title} (edited)`);
  await page.getByRole("button", { name: /^Delete$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(`${title} (edited)`)).toHaveCount(0);
  await expect
    .poll(async () => (await bundle(page)).days.some((d: { events: Array<{ title: string }> }) => d.events.some((e) => e.title.startsWith(title))))
    .toBe(false);
});

test("day notes save from the day menu", async ({ page }) => {
  const date = await openDay(page, 2);
  const original = (await bundle(page)).days.find((d: { date: string }) => d.date === date).notes;
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Edit day" }).click();
  const notes = page.getByLabel("Day notes");
  await notes.fill(`E2E day note ${stamp}`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await bundle(page)).days.find((d: { date: string }) => d.date === date).notes).toBe(`E2E day note ${stamp}`);
  await expect(page.getByRole("button", { name: "Day notes" })).toBeVisible();
  // Restore the original notes.
  await page.request.put(`/api/days/${date}`, { data: { notes: original } });
});

test("to-dos and packing check off without clobbering other fields", async ({ page }) => {
  await page.goto("/app/lists");
  const todo = `E2E todo ${stamp}`;
  await page.getByPlaceholder("Add a to-do").fill(todo);
  await page.getByPlaceholder("Add a to-do").press("Enter");
  await page.getByRole("checkbox", { name: todo }).click();
  await expect.poll(async () => (await bundle(page)).reminders.find((r: { title: string }) => r.title === todo)?.isDone).toBe(true);

  // Regression: a packing item with quantity 5 keeps its quantity/essential flag when checked.
  const item = `E2E socks ${stamp}`;
  const created = await (await page.request.post("/api/packing", { data: { name: item, category: "clothing", quantity: 5, isEssential: true } })).json();
  await page.reload();
  await page.getByRole("checkbox", { name: item }).click();
  await expect
    .poll(async () => (await bundle(page)).packingItems.find((p: { id: number }) => p.id === created.id))
    .toMatchObject({ isPacked: true, quantity: 5, isEssential: true });
  await expect(page.getByRole("checkbox", { name: item })).toHaveAttribute("aria-checked", "true");

  // Clean up.
  const data = await bundle(page);
  await page.request.delete(`/api/reminders/${data.reminders.find((r: { title: string }) => r.title === todo).id}`);
  await page.request.delete(`/api/packing/${created.id}`);
});

test("budget: add an expense and mark it paid without losing its date", async ({ page }) => {
  const created = await (
    await page.request.post("/api/expenses", { data: { description: `E2E tour ${stamp}`, amount: 120.5, category: "Activities", purchaseDate: "2026-05-01", isBooked: true } })
  ).json();
  await page.goto("/app/budget");
  await expect(page.getByText(`E2E tour ${stamp}`)).toBeVisible();
  const row = page.locator("div.border-b", { has: page.getByRole("button", { name: `E2E tour ${stamp}`, exact: true }) });
  await expect(row).toHaveCount(1);
  await row.getByRole("checkbox").click();
  await expect
    .poll(async () => (await bundle(page)).expenses.find((e: { id: number }) => e.id === created.id))
    .toMatchObject({ isPaid: true, purchaseDate: "2026-05-01", isBooked: true });
  await page.request.delete(`/api/expenses/${created.id}`);
});

test("trip switcher changes trips", async ({ page }) => {
  await page.goto("/app");
  const before = (await bundle(page)).trip;
  // Make sure there is a second trip to switch to (the e2e account may only own its starter trip).
  let tempTripId: number | null = null;
  const me = await (await page.request.get("/api/me")).json();
  if (me.trips.length < 2) {
    tempTripId = (await (await page.request.post("/api/trips", { data: { name: `E2E Switch ${stamp}`, totalDays: 2 } })).json()).id;
    await page.request.get(`/api/trip?tripId=${before.id}`);
    await page.reload();
  }
  await page.locator("aside").getByRole("button", { name: new RegExp(before.name) }).click();
  const other = page.locator("[class*='shadow-pop'] button").filter({ hasNotText: before.name }).filter({ hasNotText: "New trip" }).first();
  const otherName = (await other.locator("span span").first().textContent())!.trim();
  await other.click();
  await expect(page.locator("h1")).toHaveText(otherName);
  // Switch back and clean up.
  await page.request.get(`/api/trip?tripId=${before.id}`);
  if (tempTripId) await page.request.delete(`/api/trips/${tempTripId}`);
});

test("new trip: create blank, then delete it", async ({ page }) => {
  await page.goto("/new");
  await page.getByPlaceholder("Utah & Arizona national parks").fill(`E2E Lisbon ${stamp}`);
  await page.getByLabel("Number of days").fill("3");
  await page.getByRole("button", { name: "Start blank" }).click();
  await page.waitForURL(/\/app$/);
  await expect(page.locator("h1")).toHaveText(`E2E Lisbon ${stamp}`);
  await expect.poll(async () => (await bundle(page)).days.length).toBe(3);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Delete trip" }).click();
  // Must type the trip name.
  const confirmButton = page.getByRole("dialog").getByRole("button", { name: "Delete trip" });
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel("Trip name").fill("wrong name");
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel("Trip name").fill(`E2E Lisbon ${stamp}`);
  await confirmButton.click();
  await expect(page.locator("h1")).not.toHaveText(`E2E Lisbon ${stamp}`);
  const me = await (await page.request.get("/api/me")).json();
  expect(me.trips.some((t: { name: string }) => t.name === `E2E Lisbon ${stamp}`)).toBe(false);
});

test("preferences: 24-hour time and moving checked items", async ({ page }) => {
  const date = await openDay(page, 1);
  const data = await bundle(page);
  const day = data.days.find((d: { date: string }) => d.date === date);
  const created = await (
    await page.request.post("/api/events", { data: { dayId: day.id, title: `E2E pref ${stamp}`, startTime: "19:05", category: "food" } })
  ).json();
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(`7:05 PM.*E2E pref ${stamp}`) })).toBeVisible();

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Preferences" }).last().click(); // the "More" menu item (the sidebar gear opens the same sheet)
  await page.getByRole("switch", { name: "24-hour time" }).click();
  await expect(page.getByRole("switch", { name: "24-hour time" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: new RegExp(`19:05.*E2E pref ${stamp}`) })).toBeVisible();

  // Survives reload (stored on this device).
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(`19:05.*E2E pref ${stamp}`) })).toBeVisible();
  await page.evaluate(() => window.localStorage.removeItem("northstar.prefs"));
  await page.request.delete(`/api/events/${created.id}`);

  // Checked to-dos stay in place by default.
  const first = `E2E keep A ${stamp}`;
  const second = `E2E keep B ${stamp}`;
  const a = await (await page.request.post("/api/reminders", { data: { title: first, dueDate: "2000-01-01" } })).json();
  const b = await (await page.request.post("/api/reminders", { data: { title: second, dueDate: "2000-01-01" } })).json();
  await page.goto("/app/lists");
  const titles = () => page.locator("[data-flip-id]").evaluateAll((rows) => rows.map((row) => row.textContent ?? ""));
  const indexOf = async (title: string) => (await titles()).findIndex((text) => text.includes(title));
  await expect.poll(() => indexOf(first)).toBeGreaterThanOrEqual(0);
  const before = await indexOf(first);
  await page.getByRole("checkbox", { name: first }).first().click();
  await page.waitForTimeout(1500);
  expect(await indexOf(first)).toBe(before);

  // With the preference on, it slides below unchecked rows after a beat.
  await page.evaluate(() => window.localStorage.setItem("northstar.prefs", JSON.stringify({ checkedToBottom: true })));
  await page.reload();
  await expect.poll(async () => (await indexOf(first)) > (await indexOf(second))).toBe(true);
  await page.getByRole("checkbox", { name: first }).first().click(); // uncheck
  await expect.poll(async () => (await indexOf(first)) < (await indexOf(second))).toBe(true);
  await page.evaluate(() => window.localStorage.removeItem("northstar.prefs"));

  await page.request.delete(`/api/reminders/${a.id}`);
  await page.request.delete(`/api/reminders/${b.id}`);
});

test("deleting a list item asks first", async ({ page }) => {
  const title = `E2E confirm ${stamp}`;
  const created = await (await page.request.post("/api/reminders", { data: { title } })).json();
  await page.goto("/app/lists");
  await page.getByRole("button", { name: title }).first().click();
  await page.getByRole("button", { name: "Delete" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect.poll(async () => (await bundle(page)).reminders.some((r: { id: number }) => r.id === created.id)).toBe(true);
  await page.getByRole("button", { name: "Delete" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect.poll(async () => (await bundle(page)).reminders.some((r: { id: number }) => r.id === created.id)).toBe(false);
});

test("layout: whole day rows click, sidebar collapses, list/map resize, profile menu", async ({ page }) => {
  await page.goto("/app");
  const shot = (name: string) => page.screenshot({ path: `test-results/screens/layout-${name}.png` });

  // Whole-trip view: a map pin opens that stop's editor (it doesn't jump to the day).
  await page.locator(".leaflet-marker-icon.ns-pin").last().click(); // topmost (pins can stack)
  await expect(page.getByLabel("Stop name")).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
  await page.keyboard.press("Escape");

  // Clicking the far right of a day row (outside the title) opens that day.
  const row = page.getByRole("link", { name: /^Day 2$/ });
  const box = (await row.boundingBox())!;
  await page.mouse.click(box.x + box.width - 12, box.y + box.height / 2);
  await page.waitForURL(/\/app\/days\//);
  await page.goto("/app");

  // Resizable divider between the list and the map.
  const handle = page.locator("[data-slot='resizable-handle']");
  await expect(handle).toBeVisible();
  const list = page.locator("[data-slot='resizable-panel']").first();
  const before = (await list.boundingBox())!.width;
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 160, h.y + h.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await list.boundingBox())!.width).toBeGreaterThan(before + 100);
  await shot("resized");

  // Profile: the whole bottom area is one button.
  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByRole("button", { name: "Preferences" }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await shot("profile-menu");
  await page.keyboard.press("Escape");

  // Collapse to a rail, survives reload, expands back.
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await shot("collapsed");
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  await page.evaluate(() => window.localStorage.removeItem("northstar-plan"));

  // Street-level map detail.
  await page.goto("/app/days/" + (await bundle(page)).days[1].date);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(2500);
  await shot("map-zoomed");
});
