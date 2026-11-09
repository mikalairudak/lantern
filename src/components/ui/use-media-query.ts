"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The query's list, or none where the browser has no media queries to follow, as jsdom has
 * none, nor a test's stand-in that only says whether one matches.
 */
function listOf(query: string): MediaQueryList | null {
  if (typeof window.matchMedia !== "function") return null;
  const list = window.matchMedia(query) as Partial<MediaQueryList>;
  return typeof list.addEventListener === "function" ? (list as MediaQueryList) : null;
}

/**
 * Whether a media query matches, kept in step as it changes. The server reads false, and so
 * does a browser that cannot say.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = listOf(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => listOf(query)?.matches ?? false,
    () => false,
  );
}
