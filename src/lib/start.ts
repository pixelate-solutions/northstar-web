const DEFAULT_START_PATH = "/start";

export function getSafeRedirectPath(value?: string | string[] | null) {
  const path = Array.isArray(value) ? value[0] : value;

  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_START_PATH;
  }

  return path;
}

export function buildAuthHref(pathname: "/sign-in" | "/sign-up", redirectPath = DEFAULT_START_PATH) {
  const safeRedirectPath = getSafeRedirectPath(redirectPath);
  const params = new URLSearchParams({ redirect_url: safeRedirectPath });

  return `${pathname}?${params.toString()}`;
}

export { DEFAULT_START_PATH };
