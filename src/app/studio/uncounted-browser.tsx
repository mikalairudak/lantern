"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/components/ui/cn";
import { LINK_CLASSES, TARGET_CLASSES } from "@/features/day/link-classes";
import {
  isUncountedBrowser,
  markUncountedBrowser,
  subscribeUncountedBrowser,
} from "@/lib/analytics/uncounted-browser";

export const UNCOUNTED_LINE = "This browser isn't counted in page views or events.";
export const COUNTED_LINE = "This browser is counted again, until the studio is next opened.";
export const COUNT_IT = "Count this browser";
export const DONT_COUNT_IT = "Don't count this browser";

function readMark(): boolean {
  return isUncountedBrowser();
}

/** The server cannot read the mark, so the line waits for the browser. */
function serverMark(): null {
  return null;
}

/**
 * The studio's line on whether this browser counts. Opening the studio marks the browser as
 * the owner's, so it counts no page view and sends no product event (`docs/decisions.md`,
 * "Product events are kept under a visitor key that lives one day"); the button counts it again,
 * until the studio next opens, or marks it back. Set under the studio's list, so its arrival moves
 * nothing.
 */
export function UncountedBrowser() {
  // Before the mark is read, so the first line the browser draws is the marked one.
  useEffect(() => {
    markUncountedBrowser(true);
  }, []);
  const isUncounted = useSyncExternalStore<boolean | null>(
    subscribeUncountedBrowser,
    readMark,
    serverMark,
  );
  if (isUncounted === null) return null;
  return (
    <p className="flex flex-wrap gap-x-5 gap-y-2 text-small text-muted">
      <span>{isUncounted ? UNCOUNTED_LINE : COUNTED_LINE}</span>
      <button
        type="button"
        onClick={() => markUncountedBrowser(!isUncounted)}
        className={cn(LINK_CLASSES, TARGET_CLASSES)}
      >
        {isUncounted ? COUNT_IT : DONT_COUNT_IT}
      </button>
    </p>
  );
}
