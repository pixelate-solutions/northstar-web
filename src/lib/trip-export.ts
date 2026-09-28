import type { Event, Expense, Location, PackingItem, Reminder } from "@/db/schema";
import { getCategoryConfig } from "@/lib/category-config";
import { product } from "@/lib/product";
import { getCountdownLabel } from "@/lib/trip-data";
import { resolveTravelImageUrl } from "@/lib/travel-images";
import type { AppDataBundle, DaySummary } from "@/lib/types";
import {
  formatCurrency,
  formatDate,
  formatDateMedium,
  formatTimeRange,
  pluralize,
  sortEventsByTime,
} from "@/lib/utils";

// Mirrors the defaults used by the in-app budget screen.
const DEFAULT_FOOD_ESTIMATE_PER_DAY = 60;
const BUDGET_COLORS = ["#f59e0b", "#ea580c", "#22c55e", "#3b82f6", "#a855f7", "#ef4444"];

interface TripExportOptions {
  now?: Date;
  timeZone?: string;
}

interface ExportPin {
  lat: number;
  lng: number;
  title: string;
  color: string;
  label: string;
  time: string;
  place: string;
  mapsUrl: string;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Preserves line breaks from free-text fields such as notes.
function escapeMultiline(value: string | null | undefined): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function safeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

// JSON embedded inside a <script> tag must not be able to close the tag.
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function toCoordinate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "trip"
  );
}

export function getTripExportFilename(tripName: string) {
  return `${slugify(tripName)}-northstar.html`;
}

function getTodayInTimeZone(now: Date, timeZone?: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function eventCoordinates(event: Event) {
  const lat = toCoordinate(event.lat);
  const lng = toCoordinate(event.lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function locationMapsUrl(location: Location) {
  return (
    safeUrl(location.googleMapsUrl) ??
    mapsSearchUrl(`${Number(location.lat)},${Number(location.lng)}`)
  );
}

function eventMapsUrl(event: Event) {
  const coords = eventCoordinates(event);
  if (event.location?.trim()) return mapsSearchUrl(event.location);
  if (coords) return mapsSearchUrl(`${coords.lat},${coords.lng}`);
  return null;
}

// Same matching rule the day schedule uses to borrow a location photo for an event.
function findEventImage(event: Event, locations: Location[]) {
  const keys = [event.title, event.location]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().toLowerCase());
  const withImages = locations.filter((location) => location.imageUrl);

  for (const key of keys) {
    const exact = withImages.find((location) => location.name.trim().toLowerCase() === key);
    if (exact) return exact.imageUrl;
    const partial = withImages.find((location) => {
      const name = location.name.trim().toLowerCase();
      return name.includes(key) || key.includes(name);
    });
    if (partial) return partial.imageUrl;
  }

  return null;
}

// Event pins first (in schedule order), then any locations not already represented by an event.
function getDayPins(day: DaySummary): ExportPin[] {
  const eventPins = sortEventsByTime(day.events).flatMap((event) => {
    const coords = eventCoordinates(event);
    if (!coords) return [];
    const config = getCategoryConfig(event.category);
    return [
      {
        ...coords,
        title: event.title,
        color: config.color,
        label: config.label,
        time: formatTimeRange(event.startTime, event.endTime),
        place: event.location ?? "",
        mapsUrl: eventMapsUrl(event) ?? mapsSearchUrl(`${coords.lat},${coords.lng}`),
      },
    ];
  });
  const eventNames = new Set(eventPins.map((pin) => pin.title.trim().toLowerCase()));
  const locationPins = day.locations
    .filter((location) => !eventNames.has(location.name.trim().toLowerCase()))
    .flatMap((location) => {
      const lat = toCoordinate(location.lat);
      const lng = toCoordinate(location.lng);
      if (lat === null || lng === null) return [];
      const config = getCategoryConfig(location.type);
      return [
        {
          lat,
          lng,
          title: location.name,
          color: config.color,
          label: config.label,
          time: "",
          place: location.description ?? "",
          mapsUrl: locationMapsUrl(location),
        },
      ];
    });

  return [...eventPins, ...locationPins];
}

function img(src: string, alt: string, className: string) {
  return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'" />`;
}

function categoryPill(category: string) {
  const config = getCategoryConfig(category);
  return `<span class="pill" style="--c:${config.color}"><span class="dot"></span>${escapeHtml(config.label)}</span>`;
}

function statCard(label: string, value: string, hint?: string) {
  return `<div class="stat"><p class="stat-label">${escapeHtml(label)}</p><p class="stat-value">${escapeHtml(value)}</p>${
    hint ? `<p class="stat-hint">${escapeHtml(hint)}</p>` : ""
  }</div>`;
}

function progressBar(percent: number, color = "var(--accent)") {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return `<div class="progress" role="progressbar" aria-valuenow="${clamped}" aria-valuemin="0" aria-valuemax="100"><span style="width:${clamped}%;background:${color}"></span></div>`;
}

function renderEvent(event: Event, locations: Location[]) {
  const config = getCategoryConfig(event.category);
  const time = formatTimeRange(event.startTime, event.endTime);
  const coords = eventCoordinates(event);
  const mapsUrl = eventMapsUrl(event);
  const image = findEventImage(event, locations);
  const cost = Number(event.cost ?? 0);

  return `<article class="event" style="--c:${config.color}">
    <div class="event-time">${time ? escapeHtml(time) : "Anytime"}</div>
    <div class="event-body">
      <div class="event-head">
        <h4>${escapeHtml(event.title)}</h4>
        <div class="event-tags">
          ${categoryPill(event.category)}
          ${event.isBooked ? `<span class="tag tag-good">Booked</span>` : ""}
          ${cost > 0 ? `<span class="tag">${escapeHtml(formatCurrency(cost))}</span>` : ""}
        </div>
      </div>
      ${
        event.location
          ? `<p class="event-place"><span class="icon">📍</span>${escapeHtml(event.location)}</p>`
          : ""
      }
      ${event.description ? `<p class="event-desc">${escapeMultiline(event.description)}</p>` : ""}
      ${event.tip ? `<p class="tip"><strong>Notes</strong> ${escapeMultiline(event.tip)}</p>` : ""}
      <div class="event-links">
        ${mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Maps →</a>` : ""}
        ${coords ? `<span class="coords">${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}</span>` : ""}
      </div>
    </div>
    ${image ? img(resolveTravelImageUrl(image, event.title), event.title, "event-img") : ""}
  </article>`;
}

function renderLocation(location: Location) {
  const config = getCategoryConfig(location.type);
  const lat = Number(location.lat);
  const lng = Number(location.lng);

  return `<article class="place" style="--c:${config.color}">
    ${img(resolveTravelImageUrl(location.imageUrl, location.name), location.name, "place-img")}
    <div class="place-body">
      <div class="event-head">
        <h4>${escapeHtml(location.name)}</h4>
        ${categoryPill(location.type)}
      </div>
      ${location.description ? `<p class="event-desc">${escapeMultiline(location.description)}</p>` : ""}
      ${location.tip ? `<p class="tip"><strong>Tip</strong> ${escapeMultiline(location.tip)}</p>` : ""}
      <div class="event-links">
        <a href="${escapeHtml(locationMapsUrl(location))}" target="_blank" rel="noopener noreferrer">Open in Google Maps →</a>
        <span class="coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
      </div>
    </div>
  </article>`;
}

function renderDay(
  day: DaySummary,
  index: number,
  days: DaySummary[],
  packingItems: PackingItem[],
  reminders: Reminder[]
) {
  const events = sortEventsByTime(day.events);
  const dayCost = events.reduce((sum, event) => sum + Number(event.cost ?? 0), 0);
  const foodEvents = events.filter((event) => event.category === "food");
  const dayPacking = packingItems.filter((item) => item.daySpecific === day.id);
  const dayReminders = reminders.filter((item) => item.dayId === day.id);
  const cover = resolveTravelImageUrl(day.coverImageUrl, `${day.title} ${day.location}`);
  const previous = days[index - 1];
  const next = days[index + 1];
  const hasPins = getDayPins(day).length > 0;

  return `<section class="day" id="day-${day.dayNumber}">
    <div class="day-hero">
      ${img(cover, day.title, "day-hero-img")}
      <div class="day-hero-overlay">
        <p class="eyebrow light">Day ${day.dayNumber} · ${escapeHtml(formatDateMedium(day.date))}</p>
        <h2>${escapeHtml(day.title)}</h2>
        <p class="day-sub">${escapeHtml(day.location)} · ${escapeHtml(day.sleepLocation ?? "Stay TBD")}</p>
      </div>
    </div>

    <div class="day-grid">
      <div class="badges">
        <span class="badge">🛏️ ${escapeHtml(day.sleepLocation ? `Sleep: ${day.sleepLocation}` : "Sleep TBD")}</span>
        ${day.driveInfo ? `<span class="badge">🚗 ${escapeHtml(day.driveInfo)}</span>` : ""}
        <a class="badge link" href="${escapeHtml(mapsSearchUrl(day.location))}" target="_blank" rel="noopener noreferrer">🗺️ ${escapeHtml(day.location)}</a>
      </div>

      <div class="stats three">
        ${statCard("Events", String(events.length))}
        ${statCard("Locations", String(day.locations.length))}
        ${statCard("Estimated Cost", formatCurrency(dayCost))}
      </div>

      <div class="card">
        <h3>Schedule</h3>
        ${
          events.length
            ? `<div class="timeline">${events.map((event) => renderEvent(event, day.locations)).join("")}</div>`
            : `<p class="muted">No events planned for this day.</p>`
        }
      </div>

      ${
        hasPins
          ? `<div class="card"><h3>Day Map</h3><div class="map day-map" data-day="${day.dayNumber}"><p class="map-fallback">Connect to the internet to load the interactive map.</p></div></div>`
          : ""
      }

      ${
        day.locations.length
          ? `<div class="card"><h3>Locations</h3><div class="places">${day.locations.map(renderLocation).join("")}</div></div>`
          : ""
      }

      <div class="two-col">
        <div class="card">
          <h3>Food Highlights</h3>
          ${
            foodEvents.length
              ? `<ul class="list">${foodEvents
                  .map(
                    (event) =>
                      `<li><strong>${escapeHtml(event.title)}</strong><span class="muted">${escapeHtml(
                        [formatTimeRange(event.startTime, event.endTime), event.location].filter(Boolean).join(" · ") ||
                          "Time TBD"
                      )}</span></li>`
                  )
                  .join("")}</ul>`
              : `<p class="muted">No food stops planned.</p>`
          }
        </div>
        <div class="card">
          <h3>Drive Summary</h3>
          <p>${day.driveInfo ? escapeMultiline(day.driveInfo) : `<span class="muted">No drive summary for this day.</span>`}</p>
          <p class="event-links"><a href="${escapeHtml(mapsSearchUrl(day.location))}" target="_blank" rel="noopener noreferrer">Open in Google Maps →</a></p>
        </div>
      </div>

      <div class="card">
        <h3>Notes</h3>
        ${day.notes?.trim() ? `<p class="notes">${escapeMultiline(day.notes)}</p>` : `<p class="muted">No notes for this day.</p>`}
      </div>

      ${
        dayPacking.length || dayReminders.length
          ? `<div class="two-col">
              ${
                dayPacking.length
                  ? `<div class="card"><h3>Day Packing List</h3><ul class="list">${dayPacking
                      .map(
                        (item) =>
                          `<li><span>${item.isPacked ? "✅" : "⬜"} ${escapeHtml(item.name)}</span><span class="muted">${item.quantity ?? 1}x</span></li>`
                      )
                      .join("")}</ul></div>`
                  : ""
              }
              ${
                dayReminders.length
                  ? `<div class="card"><h3>Day Reminders</h3><ul class="list">${dayReminders
                      .map(
                        (item) =>
                          `<li><span>${item.isDone ? "✅" : "⬜"} ${escapeHtml(item.title)}</span><span class="muted">${escapeHtml(titleCase(item.priority))}</span></li>`
                      )
                      .join("")}</ul></div>`
                  : ""
              }
            </div>`
          : ""
      }

      <nav class="day-pager">
        ${previous ? `<a href="#day-${previous.dayNumber}">← Day ${previous.dayNumber}: ${escapeHtml(previous.title)}</a>` : "<span></span>"}
        <a href="#top">Back to top ↑</a>
        ${next ? `<a href="#day-${next.dayNumber}">Day ${next.dayNumber}: ${escapeHtml(next.title)} →</a>` : "<span></span>"}
      </nav>
    </div>
  </section>`;
}

function renderItinerary(days: DaySummary[]) {
  if (!days.length) return `<p class="muted">No days have been added to this trip yet.</p>`;

  return `<div class="table-wrap"><table>
    <thead><tr><th>Day</th><th>Date</th><th>Plan</th><th>Location</th><th>Sleep</th><th>Events</th><th>Est. Cost</th></tr></thead>
    <tbody>${days
      .map((day) => {
        const cost = day.events.reduce((sum, event) => sum + Number(event.cost ?? 0), 0);
        const dots = sortEventsByTime(day.events)
          .map((event) => `<span class="mini-dot" title="${escapeHtml(event.title)}" style="background:${getCategoryConfig(event.category).color}"></span>`)
          .join("");
        return `<tr>
          <td><a href="#day-${day.dayNumber}">Day ${day.dayNumber}</a></td>
          <td class="nowrap">${escapeHtml(formatDateMedium(day.date))}</td>
          <td><a href="#day-${day.dayNumber}"><strong>${escapeHtml(day.title)}</strong></a></td>
          <td>${escapeHtml(day.location)}</td>
          <td>${escapeHtml(day.sleepLocation ?? "TBD")}</td>
          <td><span class="nowrap">${day.events.length} ${dots}</span></td>
          <td class="num">${escapeHtml(formatCurrency(cost))}</td>
        </tr>`;
      })
      .join("")}</tbody>
  </table></div>`;
}

function renderBudget(expenses: Expense[], days: DaySummary[]) {
  const totalBooked = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const totalPaid = expenses
    .filter((expense) => Boolean(expense.isPaid))
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const remaining = totalBooked - totalPaid;
  const plannedEventCost = days.reduce(
    (sum, day) => sum + day.events.reduce((eventSum, event) => eventSum + Number(event.cost ?? 0), 0),
    0
  );
  const safeDayCount = Math.max(days.length, 1);
  const estimatedFood = DEFAULT_FOOD_ESTIMATE_PER_DAY * safeDayCount;
  const projectedTotal = totalBooked + plannedEventCost + estimatedFood;
  const paidPercent = totalBooked > 0 ? (totalPaid / totalBooked) * 100 : 0;

  const categoryTotals = Object.entries(
    expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + Number(expense.amount ?? 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  // Conic-gradient donut: no chart library needed in a static file.
  let cursor = 0;
  const donutStops = categoryTotals
    .map(([, value], index) => {
      const start = cursor;
      cursor += totalBooked > 0 ? (value / totalBooked) * 100 : 0;
      return `${BUDGET_COLORS[index % BUDGET_COLORS.length]} ${start}% ${cursor}%`;
    })
    .join(", ");

  return `<div class="stats six">
      ${statCard("Booked", formatCurrency(totalBooked))}
      ${statCard("Paid", formatCurrency(totalPaid))}
      ${statCard("Remaining", formatCurrency(remaining))}
      ${statCard("Itinerary Costs", formatCurrency(plannedEventCost), "Sum of event costs")}
      ${statCard("Food Estimate", formatCurrency(estimatedFood), `${formatCurrency(DEFAULT_FOOD_ESTIMATE_PER_DAY)}/day × ${safeDayCount} ${pluralize(safeDayCount, "day")}`)}
      ${statCard("Projected Total", formatCurrency(projectedTotal), `${formatCurrency(projectedTotal / safeDayCount)} avg per day`)}
    </div>
    <div class="card">
      <div class="row-between"><h3>Paid vs. Booked</h3><span class="muted">${Math.round(paidPercent)}% paid</span></div>
      ${progressBar(paidPercent)}
    </div>
    <div class="two-col">
      <div class="card">
        <h3>Category Breakdown</h3>
        ${
          categoryTotals.length
            ? `<div class="donut-wrap">
                <div class="donut" style="background:conic-gradient(${donutStops})"><div class="donut-hole"><span>${escapeHtml(formatCurrency(totalBooked))}</span><small>total</small></div></div>
                <ul class="legend">${categoryTotals
                  .map(
                    ([name, value], index) =>
                      `<li><span class="swatch" style="background:${BUDGET_COLORS[index % BUDGET_COLORS.length]}"></span><span>${escapeHtml(titleCase(name))}</span><strong>${escapeHtml(formatCurrency(value))}</strong></li>`
                  )
                  .join("")}</ul>
              </div>`
            : `<p class="muted">No expenses recorded yet.</p>`
        }
      </div>
      <div class="card">
        <h3>Cost by Day</h3>
        ${
          days.length
            ? `<ul class="list">${days
                .map((day) => {
                  const cost = day.events.reduce((sum, event) => sum + Number(event.cost ?? 0), 0);
                  return `<li><a href="#day-${day.dayNumber}">Day ${day.dayNumber} · ${escapeHtml(day.title)}</a><strong>${escapeHtml(formatCurrency(cost))}</strong></li>`;
                })
                .join("")}</ul>`
            : `<p class="muted">No days yet.</p>`
        }
      </div>
    </div>
    <div class="card">
      <h3>Expenses</h3>
      ${
        expenses.length
          ? `<div class="table-wrap"><table>
              <thead><tr><th>Description</th><th>Category</th><th class="num">Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>${expenses
                .map((expense) => {
                  const receipt = safeUrl(expense.receiptUrl);
                  return `<tr>
                    <td><strong>${escapeHtml(expense.description)}</strong>${
                      expense.notes ? `<div class="muted small">${escapeMultiline(expense.notes)}</div>` : ""
                    }${receipt ? `<div class="small"><a href="${escapeHtml(receipt)}" target="_blank" rel="noopener noreferrer">Receipt →</a></div>` : ""}</td>
                    <td>${escapeHtml(titleCase(expense.category))}</td>
                    <td class="num">${escapeHtml(formatCurrency(expense.amount))}</td>
                    <td class="nowrap">${expense.isBooked ? `<span class="tag tag-good">Booked</span>` : ""}${
                      expense.isPaid ? `<span class="tag tag-good">Paid</span>` : `<span class="tag tag-warn">Unpaid</span>`
                    }</td>
                    <td class="nowrap">${expense.purchaseDate ? escapeHtml(formatDate(expense.purchaseDate)) : "N/A"}</td>
                  </tr>`;
                })
                .join("")}</tbody>
              <tfoot><tr><td colspan="2">Total</td><td class="num">${escapeHtml(formatCurrency(totalBooked))}</td><td colspan="2"></td></tr></tfoot>
            </table></div>`
          : `<p class="muted">No expenses recorded yet.</p>`
      }
    </div>`;
}

function renderPacking(packingItems: PackingItem[], days: DaySummary[]) {
  if (!packingItems.length) return `<div class="card"><p class="muted">No packing items yet.</p></div>`;

  const packed = packingItems.filter((item) => item.isPacked).length;
  const dayById = new Map(days.map((day) => [day.id, day]));
  const byCategory = packingItems.reduce<Map<string, PackingItem[]>>((acc, item) => {
    const list = acc.get(item.category) ?? [];
    list.push(item);
    acc.set(item.category, list);
    return acc;
  }, new Map());

  return `<div class="card">
      <div class="row-between"><h3>Overall Progress</h3><span class="muted">${packed} of ${packingItems.length} packed</span></div>
      ${progressBar((packed / packingItems.length) * 100)}
    </div>
    <div class="packing-grid">${[...byCategory.entries()]
      .map(([category, items]) => {
        const categoryPacked = items.filter((item) => item.isPacked).length;
        return `<div class="card">
          <div class="row-between"><h3>${escapeHtml(titleCase(category))}</h3><span class="muted small">${categoryPacked}/${items.length}</span></div>
          <p class="muted small">${items.length} ${pluralize(items.length, "item")} in this category</p>
          ${progressBar((categoryPacked / items.length) * 100, "var(--primary)")}
          <ul class="checklist">${items
            .map((item) => {
              const day = item.daySpecific ? dayById.get(item.daySpecific) : null;
              return `<li class="${item.isPacked ? "done" : ""}">
                <span class="check">${item.isPacked ? "✓" : ""}</span>
                <div>
                  <span class="item-name">${escapeHtml(item.name)}</span>
                  <span class="muted small">x${item.quantity ?? 1}</span>
                  ${item.isEssential ? `<span class="tag tag-warn">Essential</span>` : ""}
                  ${day ? `<a class="tag" href="#day-${day.dayNumber}">Day ${day.dayNumber}</a>` : ""}
                  ${item.notes ? `<div class="muted small">${escapeMultiline(item.notes)}</div>` : ""}
                </div>
              </li>`;
            })
            .join("")}</ul>
        </div>`;
      })
      .join("")}</div>`;
}

function renderReminders(reminders: Reminder[], days: DaySummary[], today: string) {
  if (!reminders.length) return `<div class="card"><p class="muted">No reminders yet.</p></div>`;

  const dayById = new Map(days.map((day) => [day.id, day]));
  const priorityColor: Record<string, string> = { high: "#ef4444", medium: "#eab308", low: "#22c55e" };
  const sections: Array<[string, Reminder[]]> = [
    ["Overdue", reminders.filter((item) => item.dueDate && !item.isDone && item.dueDate < today)],
    ["Today", reminders.filter((item) => !item.isDone && item.dueDate === today)],
    ["Upcoming", reminders.filter((item) => !item.isDone && (!item.dueDate || item.dueDate > today))],
    ["Completed", reminders.filter((item) => Boolean(item.isDone))],
  ];

  return sections
    .filter(([, items]) => items.length)
    .map(
      ([label, items]) => `<div class="card">
        <h3>${label} <span class="muted small">(${items.length})</span></h3>
        <div class="reminders">${items
          .map((item) => {
            const day = item.dayId ? dayById.get(item.dayId) : null;
            return `<div class="reminder ${item.isDone ? "done" : ""}" style="--c:${priorityColor[item.priority] ?? "#64748b"}">
              <div class="row-between">
                <strong>${escapeHtml(item.title)}</strong>
                <span class="nowrap"><span class="pill"><span class="dot"></span>${escapeHtml(titleCase(item.priority))}</span>${
                  item.isDone ? `<span class="tag tag-good">Completed</span>` : ""
                }</span>
              </div>
              ${item.body ? `<p class="event-desc">${escapeMultiline(item.body)}</p>` : ""}
              <p class="muted small">Due ${item.dueDate ? escapeHtml(formatDate(item.dueDate)) : "whenever"}${
                day ? ` · <a href="#day-${day.dayNumber}">Day ${day.dayNumber}: ${escapeHtml(day.title)}</a>` : ""
              }</p>
            </div>`;
          })
          .join("")}</div>
      </div>`
    )
    .join("");
}

const STYLES = `
:root{--bg:#f7fbfc;--fg:#0f172a;--card:#fff;--primary:#164e80;--accent:#119488;--muted:#5c6c80;--muted-bg:#edf4f6;--border:#dce7ec;--warm:#bf663e;--radius:20px;--grad:linear-gradient(135deg,#164e80,#199a92 56%,#9ad6d2)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:72px}
body{margin:0;font-family:"Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--fg);background:radial-gradient(circle at 10% 0%,rgba(22,78,128,.10),transparent 40%),radial-gradient(circle at 90% 10%,rgba(17,148,136,.10),transparent 40%),linear-gradient(180deg,#f8fbfc,#f4f8f9 40%,#fbfdfd);line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--primary);text-decoration:none}a:hover{text-decoration:underline}
h1,h2,h3,h4{margin:0;letter-spacing:-.02em;line-height:1.2}
h3{font-size:1.05rem;margin-bottom:12px}
h4{font-size:1rem}
p{margin:0}
.muted{color:var(--muted)}.small{font-size:.82rem}.nowrap{white-space:nowrap}.num{text-align:right;font-variant-numeric:tabular-nums}
.eyebrow{font-size:.72rem;text-transform:uppercase;letter-spacing:.28em;color:rgba(22,78,128,.8);font-weight:600}
.eyebrow.light{color:rgba(255,255,255,.85)}
.topbar{position:sticky;top:0;z-index:1000;display:flex;align-items:center;gap:16px;padding:10px 20px;background:rgba(255,255,255,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--border)}
.brand{font-size:.72rem;text-transform:uppercase;letter-spacing:.34em;font-weight:700;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}
.topnav{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:1}
.topnav::-webkit-scrollbar{display:none}
.topnav a{white-space:nowrap;padding:6px 12px;border-radius:999px;font-size:.84rem;color:var(--fg);background:var(--muted-bg);border:1px solid transparent}
.topnav a:hover{text-decoration:none;border-color:var(--border);background:#fff}
.print-btn{border:1px solid var(--border);background:#fff;border-radius:999px;padding:6px 14px;font:inherit;font-size:.84rem;cursor:pointer;white-space:nowrap}
main{max-width:1120px;margin:0 auto;padding:24px 20px 80px}
.hero{position:relative;border-radius:32px;overflow:hidden;min-height:340px;background:var(--grad);color:#fff;box-shadow:0 30px 80px rgba(17,46,72,.18)}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-overlay{position:relative;padding:48px 40px;min-height:340px;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;background:linear-gradient(180deg,rgba(15,23,42,.05),rgba(15,23,42,.72))}
.hero h1{font-size:clamp(2rem,5vw,3.4rem);font-weight:800}
.hero .summary{max-width:720px;opacity:.92;font-size:1.05rem}
.hero-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.hero-meta span{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(8px);padding:5px 12px;border-radius:999px;font-size:.85rem}
section.block{margin-top:40px}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:16px}
.section-head h2{font-size:1.7rem;font-weight:800}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:0 10px 30px rgba(18,43,74,.05);margin-bottom:16px;break-inside:avoid}
.stats{display:grid;gap:12px;margin-bottom:16px}
.stats.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.stats.four{grid-template-columns:repeat(4,minmax(0,1fr))}
.stats.six{grid-template-columns:repeat(3,minmax(0,1fr))}
.stat{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:16px}
.stat-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.18em;color:var(--muted)}
.stat-value{font-size:1.5rem;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums}
.stat-hint{font-size:.78rem;color:var(--muted);margin-top:2px}
.two-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.two-col>.card{margin-bottom:0}.two-col{margin-bottom:16px}
.row-between{display:flex;align-items:center;justify-content:space-between;gap:12px}
.map{height:420px;border-radius:16px;overflow:hidden;border:1px solid var(--border);background:var(--muted-bg);display:flex;align-items:center;justify-content:center}
.day-map{height:340px}
.map-fallback{color:var(--muted);font-size:.9rem;padding:20px;text-align:center}
.legend-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:.75rem;font-weight:600;color:var(--c);background:color-mix(in srgb,var(--c) 12%,white);border:1px solid color-mix(in srgb,var(--c) 30%,white);white-space:nowrap}
.dot{width:8px;height:8px;border-radius:999px;background:var(--c)}
.mini-dot{display:inline-block;width:8px;height:8px;border-radius:999px;margin-left:3px;vertical-align:middle}
.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.75rem;font-weight:600;background:var(--muted-bg);color:var(--fg);margin-right:4px;white-space:nowrap}
.tag-good{background:#dcfce7;color:#166534}.tag-warn{background:#fef3c7;color:#92400e}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);font-weight:600;padding:10px 12px;border-bottom:1px solid var(--border)}
td{padding:12px;border-bottom:1px solid var(--border);vertical-align:top}
tbody tr:hover{background:#f8fbfc}
tfoot td{font-weight:800;border-bottom:none}
.table-wrap{overflow-x:auto;background:var(--card);border:1px solid var(--border);border-radius:var(--radius)}
.card .table-wrap{border:none;border-radius:0}
.day{margin-top:48px;scroll-margin-top:72px}
.day-hero{position:relative;border-radius:28px;overflow:hidden;min-height:260px;background:var(--grad);color:#fff;margin-bottom:16px}
.day-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.day-hero-overlay{position:relative;min-height:260px;padding:32px;display:flex;flex-direction:column;justify-content:flex-end;gap:6px;background:linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,.75))}
.day-hero h2{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800}
.day-sub{opacity:.9}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.badge{background:#fff;border:1px solid var(--border);padding:6px 12px;border-radius:999px;font-size:.85rem;color:var(--fg)}
.badge.link{color:var(--primary)}
.timeline{display:flex;flex-direction:column;gap:12px}
.event{display:grid;grid-template-columns:150px 1fr auto;gap:16px;padding:16px;border-radius:16px;border:1px solid var(--border);border-left:5px solid var(--c);background:linear-gradient(90deg,color-mix(in srgb,var(--c) 6%,white),#fff 40%)}
.event-time{font-weight:700;font-size:.88rem;color:var(--primary);font-variant-numeric:tabular-nums}
.event-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.event-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.event-place{margin-top:6px;font-size:.9rem}
.icon{margin-right:4px}
.event-desc{margin-top:8px;font-size:.92rem;color:#334155}
.tip{margin-top:8px;font-size:.88rem;background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;padding:8px 12px;border-radius:12px}
.tip strong{margin-right:6px}
.event-links{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:10px;font-size:.85rem}
.coords{color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem}
.event-img{width:140px;height:100px;object-fit:cover;border-radius:12px}
.places{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.place{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:#fff;border-top:4px solid var(--c)}
.place-img{width:100%;height:170px;object-fit:cover;display:block}
.place-body{padding:14px}
.list{list-style:none;margin:0;padding:0}
.list li{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);font-size:.92rem}
.list li:last-child{border-bottom:none}
.list li>span.muted{text-align:right}
.notes{white-space:normal;background:var(--muted-bg);padding:14px;border-radius:12px}
.day-pager{display:flex;justify-content:space-between;gap:12px;font-size:.88rem;padding:8px 0}
.progress{height:10px;border-radius:999px;background:var(--muted-bg);overflow:hidden;margin-top:8px}
.progress span{display:block;height:100%;border-radius:999px}
.donut-wrap{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.donut{width:180px;height:180px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.donut-hole{width:112px;height:112px;border-radius:999px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:.95rem}
.donut-hole small{font-weight:500;color:var(--muted)}
.legend{list-style:none;padding:0;margin:0;flex:1;min-width:180px}
.legend li{display:grid;grid-template-columns:14px 1fr auto;gap:10px;align-items:center;padding:6px 0;font-size:.9rem}
.swatch{width:12px;height:12px;border-radius:4px}
.packing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.packing-grid>.card{margin-bottom:0}
.checklist{list-style:none;padding:0;margin:12px 0 0}
.checklist li{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:.92rem}
.checklist li:last-child{border-bottom:none}
.checklist li.done .item-name{text-decoration:line-through;color:var(--muted)}
.check{flex-shrink:0;width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border);display:inline-flex;align-items:center;justify-content:center;font-size:.8rem;color:#fff}
.checklist li.done .check{background:var(--accent);border-color:var(--accent)}
.item-name{font-weight:600;margin-right:6px}
.reminders{display:flex;flex-direction:column;gap:10px}
.reminder{border:1px solid var(--border);border-left:4px solid var(--c);border-radius:14px;padding:12px 14px}
.reminder.done{opacity:.7}
.footer{margin-top:60px;text-align:center;color:var(--muted);font-size:.82rem}
.pin{width:26px;height:36px}
.leaflet-popup-content{font-family:inherit;font-size:.85rem;line-height:1.4}
.leaflet-popup-content strong{display:block;font-size:.95rem;margin-bottom:2px}
@media (max-width:760px){
  .stats.three,.stats.four,.stats.six{grid-template-columns:1fr 1fr}
  .two-col,.places,.packing-grid{grid-template-columns:1fr}
  .event{grid-template-columns:1fr}
  .event-img{width:100%;height:160px}
  .hero-overlay{padding:28px 22px}
  .print-btn{display:none}
}
@media print{
  .topbar,.print-btn,.day-pager{display:none}
  body{background:#fff}
  .card,.stat,.event,.place{box-shadow:none}
  .day{break-before:page}
  .map{height:300px}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`;

// Runs in the exported file. Leaflet comes from a CDN, so maps only render when online.
const MAP_SCRIPT = `
(function(){
  var data = JSON.parse(document.getElementById("trip-map-data").textContent);
  function esc(s){return String(s||"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function pinIcon(color){
    return L.divIcon({className:"",iconSize:[26,36],iconAnchor:[13,34],popupAnchor:[0,-30],
      html:'<svg class="pin" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg"><path d="M15 1C7.3 1 1 7.2 1 14.9c0 10.4 14 26.1 14 26.1s14-15.7 14-26.1C29 7.2 22.7 1 15 1z" fill="'+color+'" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>'});
  }
  function popup(pin, day){
    return "<strong>"+esc(pin.title)+"</strong>"+
      '<span style="color:'+pin.color+';font-weight:600">'+esc(pin.label)+"</span>"+
      (pin.time?" · "+esc(pin.time):"")+
      (pin.place?"<br>"+esc(pin.place):"")+
      (day?'<br><a href="#day-'+day.dayNumber+'">Day '+day.dayNumber+": "+esc(day.title)+"</a>":"")+
      '<br><a href="'+esc(pin.mapsUrl)+'" target="_blank" rel="noopener noreferrer">Open in Maps →</a>';
  }
  function makeMap(el){
    el.innerHTML = "";
    var map = L.map(el,{scrollWheelZoom:false});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
    return map;
  }
  function fit(map, points){
    if(points.length===1){map.setView(points[0],12);} else {map.fitBounds(points,{padding:[30,30],maxZoom:13});}
  }
  if(typeof L==="undefined"){return;}
  var overview = document.getElementById("trip-map");
  if(overview){
    var all = [];
    var map = makeMap(overview);
    var route = [];
    data.forEach(function(day){
      if(day.pins.length){route.push([day.pins[0].lat,day.pins[0].lng]);}
      day.pins.forEach(function(pin){
        all.push([pin.lat,pin.lng]);
        L.marker([pin.lat,pin.lng],{icon:pinIcon(pin.color)}).addTo(map).bindPopup(popup(pin,day));
      });
    });
    if(route.length>1){L.polyline(route,{color:"#f59e0b",weight:3,opacity:.8}).addTo(map);}
    if(all.length){fit(map,all);} else {map.setView([39.5,-98.35],4);}
  }
  document.querySelectorAll(".day-map").forEach(function(el){
    var day = data.find(function(d){return String(d.dayNumber)===el.getAttribute("data-day");});
    if(!day||!day.pins.length){return;}
    var map = makeMap(el);
    var points = day.pins.map(function(pin){
      L.marker([pin.lat,pin.lng],{icon:pinIcon(pin.color)}).addTo(map).bindPopup(popup(pin,null));
      return [pin.lat,pin.lng];
    });
    if(points.length>1){L.polyline(points,{color:"#164e80",weight:3,opacity:.6,dashArray:"8 6"}).addTo(map);}
    fit(map,points);
  });
})();
`;

export function renderTripExportHtml(bundle: AppDataBundle, options: TripExportOptions = {}) {
  const now = options.now ?? new Date();
  const today = getTodayInTimeZone(now, options.timeZone);
  const { trip, packingItems, expenses, reminders } = bundle;
  const days = [...bundle.days].sort((a, b) => a.date.localeCompare(b.date));
  const tripDates = days.map((day) => day.date);

  const startDate = trip.startDate ?? tripDates[0] ?? null;
  const endDate = trip.endDate ?? tripDates[tripDates.length - 1] ?? null;
  const dateRange =
    startDate && endDate
      ? startDate === endDate
        ? formatDate(startDate)
        : `${formatDate(startDate)} – ${formatDate(endDate)}`
      : "Dates TBD";

  const eventCount = days.reduce((sum, day) => sum + day.events.length, 0);
  const locationCount = days.reduce((sum, day) => sum + day.locations.length, 0);
  const totalBooked = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const packedCount = packingItems.filter((item) => item.isPacked).length;
  const packingPercent = packingItems.length ? Math.round((packedCount / packingItems.length) * 100) : 0;
  const usedCategories = [...new Set(days.flatMap((day) => [...day.events.map((e) => e.category), ...day.locations.map((l) => l.type)]))];

  const mapData = days.map((day) => ({ dayNumber: day.dayNumber, title: day.title, pins: getDayPins(day) }));
  const hasAnyPins = mapData.some((day) => day.pins.length);
  const heroImage = resolveTravelImageUrl(trip.coverImageUrl ?? days[0]?.coverImageUrl, `${trip.destination ?? ""} ${trip.name}`);
  const exportedAt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: options.timeZone,
  }).format(now);

  const navLinks = [
    ["overview", "Overview"],
    ["itinerary", "Itinerary"],
    ...(hasAnyPins ? [["map", "Map"]] : []),
    ...days.map((day) => [`day-${day.dayNumber}`, `Day ${day.dayNumber}`]),
    ["budget", "Budget"],
    ["packing", "Packing"],
    ["reminders", "Reminders"],
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(trip.name)} · ${escapeHtml(product.name)} Trip Summary</title>
<meta name="generator" content="${escapeHtml(product.name)}" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>${STYLES}</style>
</head>
<body>
<header class="topbar" id="top">
  <span class="brand">${escapeHtml(product.name)}</span>
  <nav class="topnav">${navLinks.map(([id, label]) => `<a href="#${id}">${escapeHtml(label)}</a>`).join("")}</nav>
  <button class="print-btn" type="button" onclick="window.print()">Print / PDF</button>
</header>
<main>
  <section class="hero" id="overview">
    ${img(heroImage, trip.name, "hero-img")}
    <div class="hero-overlay">
      <p class="eyebrow light">${escapeHtml(product.name)} · Trip Summary</p>
      <h1>${escapeHtml(trip.name)}</h1>
      ${trip.summary ? `<p class="summary">${escapeMultiline(trip.summary)}</p>` : ""}
      <div class="hero-meta">
        <span>📅 ${escapeHtml(dateRange)}</span>
        ${trip.destination ? `<span>📍 ${escapeHtml(trip.destination)}</span>` : ""}
        <span>🗓️ ${days.length} ${pluralize(days.length, "day")}</span>
        <span>⏳ ${escapeHtml(getCountdownLabel(tripDates, now, { timeZone: options.timeZone }))}</span>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="stats four">
      ${statCard("Days", String(days.length), dateRange)}
      ${statCard("Events", String(eventCount), `${locationCount} saved ${pluralize(locationCount, "location")}`)}
      ${statCard("Total Booked", formatCurrency(totalBooked), `${expenses.length} ${pluralize(expenses.length, "expense")}`)}
      ${statCard("Packing", `${packingPercent}%`, `${packedCount} of ${packingItems.length} packed`)}
    </div>
  </section>

  <section class="block" id="itinerary">
    <div class="section-head"><div><p class="eyebrow">At a glance</p><h2>Itinerary</h2></div></div>
    ${renderItinerary(days)}
  </section>

  ${
    hasAnyPins
      ? `<section class="block" id="map">
          <div class="section-head"><div><p class="eyebrow">Every stop</p><h2>Trip Map</h2></div></div>
          <div class="card">
            <div class="map" id="trip-map"><p class="map-fallback">Connect to the internet to load the interactive map. Every address and coordinate is listed in the day sections below.</p></div>
            <div class="legend-row">${usedCategories.map(categoryPill).join("")}</div>
          </div>
        </section>`
      : ""
  }

  ${days.map((day, index) => renderDay(day, index, days, packingItems, reminders)).join("")}

  <section class="block" id="budget">
    <div class="section-head"><div><p class="eyebrow">Money</p><h2>Budget</h2></div></div>
    ${renderBudget(expenses, days)}
  </section>

  <section class="block" id="packing">
    <div class="section-head"><div><p class="eyebrow">Checklist</p><h2>Packing</h2></div></div>
    ${renderPacking(packingItems, days)}
  </section>

  <section class="block" id="reminders">
    <div class="section-head"><div><p class="eyebrow">To-do</p><h2>Reminders</h2></div></div>
    ${renderReminders(reminders, days, today)}
  </section>

  <p class="footer">Exported from ${escapeHtml(product.name)} on ${escapeHtml(exportedAt)}. Maps © OpenStreetMap contributors.</p>
</main>
<script id="trip-map-data" type="application/json">${jsonForScript(mapData)}</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>${MAP_SCRIPT}</script>
</body>
</html>`;
}
