"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

/**
 * Whether Lantern writes new days, for a page whose shell is built ahead of any visit: the
 * day is drawn in the shell as though it does not, and the answer, read for each visit
 * (`isLiveNow`), arrives in a part of the page of its own and is noted here. So the day
 * never waits for it, and turning the flag on or off still needs no new build. Only what a
 * visitor does with the day reads it: a city typed on the city word, a word re-planned, a
 * day that could not be written asked again; nothing the page draws before a press.
 */
let isNoted = false;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function readNoted(): boolean {
  return isNoted;
}

/** What the shell is drawn with, before any visit has asked. */
function readInShell(): boolean {
  return false;
}

/** Notes the answer for this visit once it has arrived; draws nothing. */
export function LiveFlag({ isLive }: { isLive: boolean }): null {
  useLayoutEffect(() => {
    if (isNoted === isLive) return;
    isNoted = isLive;
    for (const listener of listeners) listener();
  }, [isLive]);
  return null;
}

/** Whether Lantern writes new days: `given` where a page passes it, the noted answer otherwise. */
export function useLiveNow(given?: boolean): boolean {
  const noted = useSyncExternalStore(subscribe, readNoted, readInShell);
  return given ?? noted;
}
