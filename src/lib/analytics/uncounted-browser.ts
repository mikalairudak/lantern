/**
 * The owner's browsers count nothing (`docs/decisions.md`, "Product events are kept under a visitor
 * key that lives one day"): a browser whose storage holds the mark sends no page view and no
 * product event. Only the studio sets it, so no visitor's browser holds it unless its visitor wrote
 * it there, which leaves out that visitor alone. A browser whose storage is missing or throws, as
 * in some private windows, is counted.
 */

import { OWNER_BROWSER_STORAGE } from "@/lib/browser-storage";

/** Where the mark is kept, in `localStorage`; any value there marks the browser. */
const UNCOUNTED_STORAGE_KEY = OWNER_BROWSER_STORAGE.uncounted.key;

/** Told to the studio's line when the mark changes on this page. */
const UNCOUNTED_EVENT = "lantern-uncounted";

/** The part of the browser's storage the mark is read from. */
export type MarkStorage = Pick<Storage, "getItem">;

/** The browser's storage, or null on the server or where reading it throws. */
function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Whether this browser is marked as the owner's, which counts nothing. */
export function isUncountedBrowser(storage: MarkStorage | null = browserStorage()): boolean {
  if (storage === null) return false;
  try {
    return storage.getItem(UNCOUNTED_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Marks this browser as the owner's, or counts it again, and tells the page. */
export function markUncountedBrowser(isUncounted: boolean): void {
  const storage = browserStorage();
  try {
    if (isUncounted) storage?.setItem(UNCOUNTED_STORAGE_KEY, "1");
    else storage?.removeItem(UNCOUNTED_STORAGE_KEY);
  } catch {
    // Without storage the mark stays as it was, and the studio's line says what it is.
  }
  window.dispatchEvent(new Event(UNCOUNTED_EVENT));
}

/** Calls back when the mark changes, on this page or from another tab. */
export function subscribeUncountedBrowser(onChange: () => void): () => void {
  const fromStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === UNCOUNTED_STORAGE_KEY) onChange();
  };
  window.addEventListener(UNCOUNTED_EVENT, onChange);
  window.addEventListener("storage", fromStorage);
  return () => {
    window.removeEventListener(UNCOUNTED_EVENT, onChange);
    window.removeEventListener("storage", fromStorage);
  };
}
