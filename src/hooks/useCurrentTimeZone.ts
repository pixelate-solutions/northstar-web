"use client";

import { useSyncExternalStore } from "react";

export function useCurrentTimeZone() {
  return useSyncExternalStore(
    () => () => undefined,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => undefined
  );
}
