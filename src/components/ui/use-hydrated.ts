"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * False on the server and in the frame that hydrates it, true from the next: for what only
 * the browser knows, such as a list it keeps, which drawn sooner would push what the server
 * drew. A page drawn in the browser alone, as in a test, is hydrated from its first frame.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
