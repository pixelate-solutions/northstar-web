export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** The trip on screen, sent as `x-trip-id` so requests apply to it even if another device opened a different trip. */
let currentTripId: number | null = null;

export function setCurrentTripId(id: number | null) {
  currentTripId = id;
}

export function tripHeaders(): Record<string, string> {
  return currentTripId ? { "x-trip-id": String(currentTripId) } : {};
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...tripHeaders(),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new ApiError(data?.error ?? `Request failed (${response.status})`, response.status);
  }
  return data as T;
}
