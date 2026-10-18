"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { usePrefs } from "@/lib/prefs";

/**
 * Ordering for checkable rows. By default checked rows stay in place; with the
 * "move checked to bottom" preference a just-checked row strikes through, holds
 * for a moment, then slides down.
 */
export function useCheckedOrder() {
  const [{ checkedToBottom }] = usePrefs();
  const [held, setHeld] = useState<Record<number, boolean>>({});

  const toggled = useCallback((id: number, previous: boolean) => {
    setHeld((current) => ({ ...current, [id]: previous }));
    window.setTimeout(() => {
      setHeld((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, 900);
  }, []);

  /** Comparator prefix: 0 when order shouldn't depend on checked state. */
  const compareChecked = useCallback(
    (a: { id: number; checked: boolean }, b: { id: number; checked: boolean }) => {
      if (!checkedToBottom) return 0;
      return Number(held[a.id] ?? a.checked) - Number(held[b.id] ?? b.checked);
    },
    [checkedToBottom, held]
  );

  return { toggled, compareChecked };
}

/** Animates children with `data-flip-id` from their previous position (FLIP). */
export function useFlip<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const next = new Map<string, number>();
    container.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((element) => {
      const id = element.dataset.flipId!;
      const top = element.getBoundingClientRect().top;
      next.set(id, top);
      const previous = positions.current.get(id);
      if (previous !== undefined && Math.abs(previous - top) > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        element.animate([{ transform: `translateY(${previous - top}px)` }, { transform: "translateY(0)" }], {
          duration: 420,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    });
    positions.current = next;
  }, [key]);
  return ref;
}
