"use client";

import { useLayoutEffect, useRef } from "react";
import type { StopDraft } from "@/features/abacus/day-draft";
import {
  departuresOf,
  keepPickedPlaces,
  picksWithin,
  readPickedPlaces,
  type PickedPlaces,
} from "./picked-places";
import { browserStorage } from "./your-days";

export interface PickedPlacesOptions {
  /**
   * The day's key on this device (`picked-places.ts`), or null while it has none, as before a
   * live day's answer names its id: then the places chosen hold on the page alone.
   */
  day: string | null;
  /** The day's stops as written, before anything was chosen on it, an energy included. */
  written: readonly StopDraft[];
  /** The stops on screen, and the index among its versions each shows once let go. */
  stops: readonly StopDraft[];
  committed: readonly number[];
  /** Shows the places kept, at once and as no gesture (`EnergyCurve.restore`). */
  restore: (picks: PickedPlaces) => void;
  /** The day is written whole, so each stop's versions are there to show the place kept. */
  isWhole: boolean;
  /** The visitor can change the day: only then is what it shows kept. */
  isInteractive: boolean;
}

/**
 * Keeps the places the visitor chose on a day in this browser, and shows them again when the
 * day is next opened here. Once the day is written whole, the places kept for it come back
 * before the frame is painted, unless the visitor has already changed one; from then on, each
 * time the day comes to rest under the visitor's hand, the places it shows are kept. A day
 * that shows its written places again is let go. A day's key that changes on the page, as a
 * re-plan merged into it takes its own id, keeps what is shown under the new key; nothing is
 * read for it, since the page already shows what was chosen.
 */
export function usePickedPlaces({
  day,
  written,
  stops,
  committed,
  restore,
  isWhole,
  isInteractive,
}: PickedPlacesOptions): void {
  const hasRead = useRef(false);
  const departures = departuresOf(written, stops, committed);
  // The places by what they are, since the list is worked out anew at each render.
  const shown = JSON.stringify(departures);

  useLayoutEffect(() => {
    if (day === null || !isWhole) return;
    if (!hasRead.current) {
      hasRead.current = true;
      const kept = picksWithin(written, readPickedPlaces(browserStorage(), day));
      const isUntouched = shown === JSON.stringify({});
      if (isUntouched && Object.keys(kept).length > 0) {
        restore(kept);
        // The next frame shows them, and keeps them from there.
        return;
      }
    }
    if (isInteractive) keepPickedPlaces(browserStorage(), day, JSON.parse(shown) as PickedPlaces);
  }, [day, written, isWhole, isInteractive, shown, restore]);
}
