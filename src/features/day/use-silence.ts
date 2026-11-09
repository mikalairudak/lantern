"use client";

import { useEffect, useState } from "react";

const MS_PER_SECOND = 1000;
/** A silence this long while the day is unfinished is when the waiting line may show. */
export const SILENCE_SECONDS = 0.4;
/**
 * Under reduced motion rows land whole, a stop at a time, so at the landing's pace the page
 * gains a row about every half second, longer than a silence: the line flashed for 25 to 80
 * ms before each next row. A silence there is this long, so a fast stream never shows it,
 * and a live model's rows, three seconds apart, still do.
 */
export const WHOLE_ROWS_SILENCE_SECONDS = 0.8;

/**
 * Whether a streaming day has had nothing new for a while, so the waiting line may show:
 * the latest partial has stood for `SILENCE_SECONDS`. The wait before the first token
 * counts, with no partial yet.
 */
export function useSilence(
  partial: unknown,
  isStreaming: boolean,
  seconds: number = SILENCE_SECONDS,
): boolean {
  // The partial that has stood long enough; any newer one is not silent yet.
  const [silentAt, setSilentAt] = useState<{ partial: unknown } | null>(null);

  useEffect(() => {
    if (!isStreaming) return undefined;
    const timer = window.setTimeout(() => setSilentAt({ partial }), seconds * MS_PER_SECOND);
    return () => window.clearTimeout(timer);
  }, [partial, isStreaming, seconds]);

  return isStreaming && silentAt !== null && silentAt.partial === partial;
}
