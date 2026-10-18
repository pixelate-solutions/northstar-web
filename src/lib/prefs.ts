"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface Prefs {
  /** Show times as 19:30 instead of 7:30 PM. */
  use24Hour: boolean;
  /** Slide checked to-dos, packing items and paid expenses to the bottom. */
  checkedToBottom: boolean;
}

const KEY = "northstar.prefs";
const DEFAULTS: Prefs = { use24Hour: false, checkedToBottom: false };
const listeners = new Set<() => void>();
let cached: Prefs | null = null;

function read(): Prefs {
  if (cached) return cached;
  try {
    cached = { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") };
  } catch {
    cached = DEFAULTS;
  }
  return cached!;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    cached = { ...read(), [key]: value };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(cached));
    } catch {}
    listeners.forEach((listener) => listener());
  }, []);
  return [prefs, setPref] as const;
}
