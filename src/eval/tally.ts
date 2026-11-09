import type { PlaceCheck } from "../lib/places/verify-place.ts";
import type { CheckResult } from "../lib/quality/checks.ts";

/**
 * How a live round's records are counted, for the round's own report (`day-round.ts`,
 * `place-round.ts`) and for the README's table (`readme-table.ts`) alike. Plain Node runs
 * the table's script, so this file imports nothing but types.
 */

/** A check's result as a tally reads it. */
export type TalliedCheck = Pick<CheckResult<string>, "id" | "kind" | "passed" | "value">;

/** A day or shadow as a tally reads it: its checks, or null when there was no day to score. */
export interface TalliedRecord {
  checks: readonly TalliedCheck[] | null;
}

/** The checks that say whether a day could be shown at all. */
const SHOWN_CHECKS: readonly string[] = ["shape", "normalizes"];

/** A day the normalizer refused is shown to no one; one scored without that check counts. */
function isShown({ checks }: TalliedRecord): boolean {
  return checks?.find(({ id }) => id === "normalizes")?.passed !== false;
}

export interface CheckTally {
  passed: number;
  /** The days the check was counted on. */
  scored: number;
  /** The mean measure over those days, or null for a check that measures nothing. */
  mean: number | null;
}

/**
 * How many scored days passed a check, and its mean measure where it has one; null when no
 * day carries it. A day that could not be shown counts only on the checks that say so: on
 * the others it would score nothing measured as 0, or as a pass, as an empty day does on day
 * flow.
 */
export function tallyOf(records: readonly TalliedRecord[], id: string): CheckTally | null {
  const counted = SHOWN_CHECKS.includes(id) ? records : records.filter(isShown);
  const results = counted.flatMap(({ checks }) => checks?.filter((check) => check.id === id) ?? []);
  if (results.length === 0) return null;
  const values = results.flatMap(({ value }) => (value === null ? [] : [value]));
  return {
    passed: results.filter((check) => check.passed).length,
    scored: results.length,
    mean:
      values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

/** The checks whose measure is not a share: day flow in meters, repairs as a count. */
const UNITS: Readonly<Record<string, string>> = { "day-flow": " m", repairs: "" };

/** A check's measure as its kind reads: a share to two places, meters and counts whole. */
export function measureOf(id: string, value: number): string {
  const unit = UNITS[id];
  return unit === undefined ? value.toFixed(2) : `${Math.round(value)}${unit}`;
}

/** A place's checks as the verified count reads them: a meal's area, and its name. */
export interface PlaceVerdicts {
  area: Pick<PlaceCheck, "kind"> | null;
  byName: Pick<PlaceCheck, "kind">;
}

/** Whether the route would show the place verified: a meal by its area, any other by its name. */
export function isVerified({ area, byName }: PlaceVerdicts): boolean {
  return (area ?? byName).kind === "verified";
}
