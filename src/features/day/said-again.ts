"use client";

import { useEffect, useState } from "react";

/**
 * How long a status stands empty between two acts before it says the next one's line. A status
 * is heard only as its words change, so a second act that gives the same words as the first is
 * emptied and written again; a pause of one frame between the two may be read by a screen
 * reader that gathers a region's changes, as VoiceOver can, as no change at all.
 */
export const SAID_AGAIN_PAUSE_MS = 100;

/**
 * Whether a status may say the line of the latest of `acts`, a count that grows by one at each:
 * false from each act until `SAID_AGAIN_PAUSE_MS` has passed, so the status stands empty
 * between two acts and the second is a change of its words, said again whatever it says. A
 * count drawn with its first render, or one no act has moved, is said at once.
 */
export function useSaidAgain(acts: number): boolean {
  const [saidAt, setSaidAt] = useState(acts);
  useEffect(() => {
    if (saidAt === acts) return undefined;
    const said = window.setTimeout(() => setSaidAt(acts), SAID_AGAIN_PAUSE_MS);
    return () => window.clearTimeout(said);
  }, [acts, saidAt]);
  return saidAt === acts;
}
