import "server-only";

import { getConnectedAccount, requireDb, upsertConnectedAccount, upsertIntegrationSyncState, upsertReservation } from "@/lib/ai/db";
import { decryptSecret, encryptSecret } from "@/lib/ai/security";
import type { GoogleReservationSyncResult } from "@/lib/ai/types";

const GOOGLE_PROVIDER = "google";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function getBaseUrl() {
  const env =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return env.replace(/\/+$/, "");
}

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

function getGoogleRedirectUri() {
  const env = process.env.GOOGLE_REDIRECT_URI?.trim();
  return env || `${getBaseUrl()}/api/integrations/google/callback`;
}

function encodeState(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeGoogleState(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      userId: number;
      tripId: number;
      returnTo?: string;
    };
  } catch {
    return null;
  }
}

export function buildGoogleConnectUrl(input: {
  userId: number;
  tripId: number;
  returnTo?: string;
}) {
  if (!isGoogleConfigured()) {
    throw new Error("Google OAuth is not configured.");
  }

  const state = encodeState({
    userId: input.userId,
    tripId: input.tripId,
    returnTo: input.returnTo ?? "/app",
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to exchange Google authorization code.");
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to refresh Google access token.");
  }

  return (await response.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
  };
}

async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to fetch Google profile.");
  }

  return (await response.json()) as {
    id: string;
    email: string;
    name?: string;
  };
}

function normalizeDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function detectReservationCategory(text: string) {
  const lower = text.toLowerCase();
  if (/(flight|airline|gate|terminal|boarding|iata|depart)/.test(lower)) return "flight";
  if (/(hotel|stay|check-in|check in|checkout|booking.com|marriott|hilton)/.test(lower)) {
    return "hotel";
  }
  if (/(rental car|pickup|drop-off|hertz|avis|enterprise|alamo)/.test(lower)) {
    return "car";
  }
  if (/(tour|tickets|activity|excursion|viator|guide)/.test(lower)) {
    return "tour";
  }
  if (/(restaurant|reservation for|table for|opentable)/.test(lower)) {
    return "restaurant";
  }
  return "reservation";
}

async function ensureValidGoogleAccessToken(userId: number) {
  const db = requireDb();
  const account = await getConnectedAccount(db, userId, GOOGLE_PROVIDER);
  if (!account?.encryptedAccessToken) {
    throw new Error("Google account is not connected.");
  }

  let accessToken = decryptSecret(account.encryptedAccessToken);
  const refreshToken = decryptSecret(account.encryptedRefreshToken);
  const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;

  if (!accessToken) {
    throw new Error("Google access token is unavailable.");
  }

  if (expiresAt && expiresAt.getTime() - Date.now() < 60_000) {
    if (!refreshToken) {
      throw new Error("Google access expired and no refresh token is available.");
    }

    const refreshed = await refreshGoogleAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    await upsertConnectedAccount(db, {
      userId,
      provider: GOOGLE_PROVIDER,
      accountEmail: account.accountEmail ?? null,
      externalAccountId: account.externalAccountId ?? null,
      scopes: refreshed.scope ?? account.scopes ?? null,
      encryptedAccessToken: encryptSecret(refreshed.access_token),
      encryptedRefreshToken: account.encryptedRefreshToken,
      expiresAt: refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : account.expiresAt,
      metadataJson: account.metadataJson ?? null,
    });
  }

  return accessToken;
}

async function fetchGoogleCalendarEvents(accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(
      new Date().toISOString()
    )}&maxResults=25`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      nextSyncToken: null,
      items: [],
    };
  }

  const json = (await response.json()) as {
    nextSyncToken?: string;
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: { dateTime?: string; date?: string; timeZone?: string };
      end?: { dateTime?: string; date?: string; timeZone?: string };
      status?: string;
    }>;
  };

  return {
    nextSyncToken: json.nextSyncToken ?? null,
    items: json.items ?? [],
  };
}

async function fetchGoogleGmailMessages(accessToken: string) {
  const query = encodeURIComponent('newer_than:180d (confirmation OR itinerary OR booking OR reservation OR flight OR hotel OR car rental OR tour)');
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=10`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      nextPageToken: null,
      messages: [],
    };
  }

  const json = (await response.json()) as {
    nextPageToken?: string;
    messages?: Array<{ id: string }>;
  };

  const messages = await Promise.all(
    (json.messages ?? []).map(async (message) => {
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=From`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      if (!detailResponse.ok) {
        return null;
      }

      return (await detailResponse.json()) as {
        id: string;
        snippet?: string;
        internalDate?: string;
        payload?: {
          headers?: Array<{ name: string; value: string }>;
        };
      };
    })
  );

  return {
    nextPageToken: json.nextPageToken ?? null,
    messages: messages.filter(Boolean),
  };
}

export async function connectGoogleAccountFromCode(input: {
  userId: number;
  tripId: number;
  code: string;
}) {
  if (!isGoogleConfigured()) {
    throw new Error("Google OAuth is not configured.");
  }

  const db = requireDb();
  const token = await exchangeGoogleCode(input.code);
  const profile = await fetchGoogleProfile(token.access_token);

  return upsertConnectedAccount(db, {
    userId: input.userId,
    provider: GOOGLE_PROVIDER,
    accountEmail: profile.email,
    externalAccountId: profile.id,
    scopes: token.scope ?? GOOGLE_SCOPES.join(" "),
    encryptedAccessToken: encryptSecret(token.access_token),
    encryptedRefreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : null,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    metadataJson: JSON.stringify({ name: profile.name ?? null, tripId: input.tripId }),
  });
}

export async function syncGoogleReservations(input: {
  userId: number;
  tripId: number;
}): Promise<GoogleReservationSyncResult> {
  const db = requireDb();
  const accessToken = await ensureValidGoogleAccessToken(input.userId);
  const connectedAccount = await getConnectedAccount(db, input.userId, GOOGLE_PROVIDER);
  if (!connectedAccount) {
    throw new Error("Google account is not connected.");
  }

  const [calendarData, gmailData] = await Promise.all([
    fetchGoogleCalendarEvents(accessToken),
    fetchGoogleGmailMessages(accessToken),
  ]);

  const imported = [];

  for (const item of calendarData.items ?? []) {
    const title = item.summary?.trim();
    if (!title) continue;

    const category = detectReservationCategory(
      [title, item.description, item.location].filter(Boolean).join(" ")
    );
    const reservation = await upsertReservation(db, {
      userId: input.userId,
      tripId: input.tripId,
      source: GOOGLE_PROVIDER,
      sourceId: `calendar:${item.id}`,
      category,
      title,
      providerName: "Google Calendar",
      status: item.status ?? "confirmed",
      confirmationCode: null,
      startAt: normalizeDate(item.start?.dateTime ?? item.start?.date),
      endAt: normalizeDate(item.end?.dateTime ?? item.end?.date),
      timeZone: item.start?.timeZone ?? item.end?.timeZone ?? null,
      location: item.location ?? null,
      priceTotal: null,
      currency: null,
      detailsJson: JSON.stringify({
        description: item.description ?? null,
      }),
    });
    imported.push(reservation);
  }

  for (const message of gmailData.messages ?? []) {
    if (!message) {
      continue;
    }

    const subject =
      message.payload?.headers?.find(
        (header: { name: string; value: string }) => header.name.toLowerCase() === "subject"
      )?.value ??
      "Reservation email";
    const body = `${subject} ${message.snippet ?? ""}`.trim();
    const category = detectReservationCategory(body);
    if (category === "reservation" && !/(confirm|booking|itinerary|reservation)/i.test(body)) {
      continue;
    }

    const reservation = await upsertReservation(db, {
      userId: input.userId,
      tripId: input.tripId,
      source: GOOGLE_PROVIDER,
      sourceId: `gmail:${message.id}`,
      category,
      title: subject,
      providerName: "Gmail",
      status: "confirmed",
      confirmationCode: null,
      startAt: message.internalDate ? new Date(Number(message.internalDate)) : null,
      endAt: null,
      timeZone: null,
      location: null,
      priceTotal: null,
      currency: null,
      detailsJson: JSON.stringify({
        snippet: message.snippet ?? null,
      }),
    });
    imported.push(reservation);
  }

  await upsertIntegrationSyncState(
    db,
    connectedAccount.id,
    "google-calendar",
    calendarData.nextSyncToken ?? null
  );
  await upsertIntegrationSyncState(
    db,
    connectedAccount.id,
    "gmail",
    gmailData.nextPageToken ?? null
  );

  return {
    importedCount: imported.length,
    reservations: imported,
  };
}
