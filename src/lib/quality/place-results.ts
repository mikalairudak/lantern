import type { PlaceCheckRecord } from "@/lib/live/place-checks-in-stream";
import type { CheckResult } from "./checks";

/**
 * The live day's place checks as the generation log keeps them, in the record's existing
 * `checks` (`docs/grounding.md`, "What the log keeps"): no column of their own.
 */

/**
 * An alarm for a fall, not a gate on one day: the place rounds confirmed 72% of the days'
 * places under the rule before 2026-10-31, and about 79% replayed under the one after it.
 */
export const MIN_SHARE_PLACES_CONFIRMED = 0.6;

/**
 * The place rounds moved a confirmed name a median of about 70 m, 90% within about 240 m;
 * past 500 m the model guessed the coordinates. A finding names each place past 250 m.
 */
export const MAX_PROVIDER_SHIFT_METERS = 500;
const SHIFT_WORTH_NAMING_METERS = 250;

function describe(record: PlaceCheckRecord): string {
  return `${record.id} "${record.name}"`;
}

function placesConfirmed(records: readonly PlaceCheckRecord[]): CheckResult {
  const confirmed = records.filter((record) => record.state === "confirmed").length;
  const value = records.length === 0 ? 1 : confirmed / records.length;
  const findings = records
    .filter((record) => record.state !== "confirmed")
    .map((record) => `${describe(record)} ${record.state}, ${record.reason ?? "no reason"}`);
  return {
    id: "places-confirmed",
    kind: "scored",
    passed: value >= MIN_SHARE_PLACES_CONFIRMED,
    value,
    threshold: MIN_SHARE_PLACES_CONFIRMED,
    findings,
  };
}

function providerShift(records: readonly PlaceCheckRecord[]): CheckResult {
  const shifted = records.filter((record) => record.shiftMeters !== null);
  const value = Math.max(0, ...shifted.map((record) => record.shiftMeters ?? 0));
  const findings = shifted
    .filter((record) => (record.shiftMeters ?? 0) > SHIFT_WORTH_NAMING_METERS)
    .map((record) => `${describe(record)} moved ${record.shiftMeters} m by the provider`);
  return {
    id: "provider-shift",
    kind: "scored",
    passed: value <= MAX_PROVIDER_SHIFT_METERS,
    value,
    threshold: MAX_PROVIDER_SHIFT_METERS,
    findings,
  };
}

/** How long the close waited for the last checks; at the deadline, some ended unchecked. */
function placesWait(msWaited: number, deadlineMs: number): CheckResult {
  const passed = msWaited < deadlineMs;
  return {
    id: "places-wait",
    kind: "scored",
    passed,
    value: msWaited,
    threshold: deadlineMs,
    findings: passed ? [] : [`the close waited the whole ${deadlineMs} ms for the last checks`],
  };
}

/** The three results a day whose places were checked adds to its record's checks. */
export function placeCheckResults(
  records: readonly PlaceCheckRecord[],
  msWaited: number,
  deadlineMs: number,
): CheckResult[] {
  return [placesConfirmed(records), providerShift(records), placesWait(msWaited, deadlineMs)];
}
