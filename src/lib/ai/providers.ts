import "server-only";

export interface ProviderAvailability {
  bookingCom: boolean;
  duffel: boolean;
  viator: boolean;
}

type ProviderMode = "sandbox" | "production";

function getProviderMode(): ProviderMode {
  return process.env.SANDBOX_OR_PRODUCTION?.trim().toLowerCase() === "production"
    ? "production"
    : "sandbox";
}

export function getDuffelApiToken() {
  const mode = getProviderMode();
  if (mode === "production") {
    return (
      process.env.DUFFEL_PRODUCTION_API_TOKEN?.trim() ||
      process.env.DUFFEL_API_TOKEN?.trim() ||
      null
    );
  }

  return (
    process.env.DUFFEL_SANDBOX_API_TOKEN?.trim() ||
    process.env.DUFFEL_API_TOKEN?.trim() ||
    null
  );
}

export function getViatorApiKey() {
  const mode = getProviderMode();
  if (mode === "production") {
    return (
      process.env.VIATOR_PRODUCTION_API_KEY?.trim() ||
      process.env.VIATOR_API_KEY?.trim() ||
      null
    );
  }

  return (
    process.env.VIATOR_SANDBOX_API_KEY?.trim() ||
    process.env.VIATOR_API_KEY?.trim() ||
    null
  );
}

export function getProviderAvailability(): ProviderAvailability {
  return {
    bookingCom: Boolean(
      process.env.BOOKING_COM_AFFILIATE_ID?.trim() &&
        process.env.BOOKING_COM_API_TOKEN?.trim()
    ),
    duffel: Boolean(getDuffelApiToken()),
    viator: Boolean(getViatorApiKey()),
  };
}

export function summarizeProviderAvailability() {
  const providers = getProviderAvailability();
  const mode = getProviderMode();
  return {
    mode,
    bookingCom: providers.bookingCom ? "enabled" : "not configured",
    duffel: providers.duffel ? "enabled" : "not configured",
    viator: providers.viator ? "enabled" : "not configured",
  };
}
