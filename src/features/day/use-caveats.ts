"use client";

import { useSyncExternalStore } from "react";
import { CAVEATS_KEY, readCaveats } from "./caveats";
import { browserStorage } from "./your-days";

const NO_PHRASES: readonly string[] = [];

let readFor: { text: string | null; id: string; phrases: readonly string[] } | null = null;

/** The caveats kept for a day, read again only when the stored text or the day has changed. */
function snapshotOf(id: string | null): readonly string[] {
  if (id === null) return NO_PHRASES;
  let text: string | null = null;
  try {
    text = browserStorage()?.getItem(CAVEATS_KEY) ?? null;
  } catch {
    text = null;
  }
  if (readFor === null || readFor.text !== text || readFor.id !== id) {
    readFor = { text, id, phrases: readCaveats(browserStorage(), id) };
  }
  return readFor.phrases;
}

function subscribe(listener: () => void): () => void {
  // Another tab keeping or forgetting a day's caveats.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CAVEATS_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

/**
 * The caveats this device keeps for the kept day under `id` (`caveats.ts`): none on the server
 * and in the first frame, whose HTML keeps none, then the browser's own, so the page hydrates as
 * the server drew it. None for no day.
 */
export function useKeptCaveats(id: string | null): readonly string[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshotOf(id),
    () => NO_PHRASES,
  );
}
