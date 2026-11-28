import type { ReactNode } from "react";

/** What a stop's time adds to a screen reader where the stop starts in golden hour. */
export const GOLDEN_HOUR = "golden hour";

/**
 * Golden hour in words, after a stop's time, for assistive technology alone: the time's amber
 * and the light drawn beside it are hidden from it, so "17:20" is heard as "17:20, golden hour".
 */
export function GoldenHourWords(): ReactNode {
  return <span className="sr-only">, {GOLDEN_HOUR}</span>;
}
