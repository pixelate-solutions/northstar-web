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
    `Add one stop to Day ${day.dayNumber} called "${title}" at 7:15 AM at Blue Bottle Coffee in the Ferry Building, San Francisco. Don't change anything else.`
  );
  await page.getByPlaceholder("Ask Northstar").first().press("Enter");

  // Panel replaces the map, shows progress, then a change list.
  await expect(page.getByText("Ask Northstar", { exact: true })).toBeVisible();
  await expect(page.getByText(/change(s)?$/).first()).toBeVisible({ timeout: 200_000 });

  // The answer collapses its work into "Thought for N seconds", which expands to the real tool calls.
  const thought = page.getByRole("button", { name: /^Thought for \d+ seconds?$/ });
  await expect(thought).toBeVisible();
  await thought.click();
  await expect(page.getByText(/^create_event · /).first()).toBeVisible();

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

test("Ask reads attached images and files (picker, paste)", async ({ page }) => {
  await signIn(page);
  await page.goto("/app");
  await page.getByRole("button", { name: "Send" }).first().click(); // an empty send opens the Ask panel
  await expect(page.getByRole("button", { name: "Attach files" })).toBeVisible();
  const word = `ZEBRA${Date.now().toString().slice(-4)}`;

  // A text file with a code word, through the file picker.
  await page.locator("input[type=file]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(`The secret code word is ${word}.`) });
  // A solid red image, pasted from the clipboard.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC",
    "base64"
  );
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], "red.png", { type: "image/png" }));
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea[placeholder='Ask Northstar']")!;
    textarea.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, png.toString("base64"));

  await expect(page.getByTitle("notes.txt")).toBeVisible();
  await expect(page.getByRole("img", { name: "red.png" }).first()).toBeVisible();
  const input = page.getByPlaceholder("Ask Northstar").last();
  await input.fill("Two questions, no tools needed: what is the secret code word in the text file, and what single color fills the image? Answer as 'WORD COLOR'.");
  await input.press("Enter");

  await expect(page.getByText(new RegExp(word, "i")).last()).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText(/red/i).last()).toBeVisible();
});

test("large attachments upload in parts; other users' references are rejected", async ({ page }) => {
  await signIn(page);
  const result = await page.evaluate(async () => {
    const size = 9 * 1024 * 1024; // three parts
    const file = new Blob([new Uint8Array(size).fill(65)], { type: "text/plain" });
    const start = await (await fetch("/api/ai/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: "big.txt", mimeType: "text/plain", bytes: size }) })).json();
    const parts: string[] = [];
    for (let offset = 0; offset < size; offset += start.partBytes) {
      const part = await fetch("/api/ai/uploads/parts", { method: "POST", headers: { "x-upload-token": start.token }, body: file.slice(offset, offset + start.partBytes) });
      parts.push((await part.json()).partId);
    }
    const done = await (await fetch("/api/ai/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: start.token, partIds: parts }) })).json();
    // A forged reference must not be accepted.
    const forged = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "hi", attachments: [done.ref.replace(/.$/, done.ref.endsWith("A") ? "B" : "A")] }) });
    const unsupported = await fetch("/api/ai/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: "app.exe", mimeType: "application/x-msdownload", bytes: 10 }) });
    return { parts: parts.length, fileId: done.fileId, bytes: done.bytes, forgedBody: await forged.text(), unsupported: unsupported.status };
  });
  expect(result.parts).toBe(3);
  expect(result.fileId).toMatch(/^file-/);
  expect(result.bytes).toBe(9 * 1024 * 1024);
  expect(result.forgedBody).toContain("couldn't be verified");
  expect(result.unsupported).toBe(415);
});
