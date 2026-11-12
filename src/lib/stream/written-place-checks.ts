import {
  placeCheckKey,
  type PlaceCheck as VerifierResult,
  type PlaceVerifier,
} from "@/lib/places/verify-place";
import type { GeneratedDay } from "@/lib/schema/itinerary.schema";
import { withLettersUnescaped } from "./escaped-letters";
import type { PartialDay } from "./outcome";
import { readyPlacesIn } from "./place-checks";

/**
 * A written day's place checks, played as a live day's (`src/lib/live/place-checks-in-stream.ts`):
 * a start's day carries the checks its run had (`src/lib/days/written/checks.ts`), and
 * the route answers each place with its own once the place is written, after about the time
 * Geoapify took on production, so a start shows its marks as the live day it was. Loadable in a
 * browser, as the route's module is read by the lab's pages.
 */

/**
 * How long after a place is written its recorded check arrives: about Geoapify's answer to
 * Vercel on production, 0.25 to 0.5 s (`docs/grounding.md`).
 */
export const RECORDED_CHECK_MS = 300;

/** A place its run has no check for: not checked, as when a lookup fails. */
const NOT_RECORDED: VerifierResult = { kind: "unverified", reason: "failed" };
/** A place whose stream stopped first, as the visitor left. */
const STOPPED: VerifierResult = { kind: "unverified", reason: "aborted" };

/**
 * A verifier that answers each place of a written day with the check its run recorded, by the
 * id the normalizer gives it, `delayMs` after it is asked. The place comes as the check reads
 * it, so each recorded check is found by the same reading of the whole day.
 */
export function recordedVerifierOf(
  day: GeneratedDay,
  checks: Readonly<Record<string, VerifierResult>>,
  city: string,
  delayMs: number = RECORDED_CHECK_MS,
): PlaceVerifier {
  const whole = withLettersUnescaped(day) as PartialDay;
  const byPlace = new Map<string, VerifierResult>();
  for (const { id, place } of readyPlacesIn(whole, new Set())) {
    const check = checks[id];
    if (check !== undefined) byPlace.set(placeCheckKey(place, { city }), check);
  }
  return {
    verify(place, cityToCheck, signal) {
      const check = byPlace.get(placeCheckKey(place, cityToCheck)) ?? NOT_RECORDED;
      return new Promise((resolve) => {
        if (signal?.aborted) {
          resolve(STOPPED);
          return;
        }
        const stop = (): void => {
          clearTimeout(timer);
          resolve(STOPPED);
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", stop);
          resolve(check);
        }, delayMs);
        signal?.addEventListener("abort", stop, { once: true });
      });
    },
  };
}
