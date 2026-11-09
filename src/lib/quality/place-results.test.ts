import { describe, expect, it } from "vitest";
import type { PlaceCheckRecord } from "@/lib/live/place-checks-in-stream";
import {
  MAX_PROVIDER_SHIFT_METERS,
  MIN_SHARE_PLACES_CONFIRMED,
  placeCheckResults,
} from "./place-results";

const DEADLINE_MS = 3_000;

function recordOf(fields: Partial<PlaceCheckRecord>): PlaceCheckRecord {
  return {
    id: "stop-0:p",
    name: "Honen-in",
    kind: "sacred",
    state: "confirmed",
    reason: null,
    shiftMeters: 120,
    ...fields,
  };
}

function resultsOf(records: PlaceCheckRecord[], msWaited = 400) {
  const [confirmed, shift, wait] = placeCheckResults(records, msWaited, DEADLINE_MS);
  return { confirmed, shift, wait };
}

describe("placeCheckResults", () => {
  it("names each place left unconfirmed or unchecked, with why, and passes while enough are confirmed", () => {
    const { confirmed } = resultsOf([
      recordOf({}),
      recordOf({ id: "stop-1:p", name: "Shirakawa Canal", state: "confirmed", shiftMeters: 90 }),
      recordOf({
        id: "stop-2:a1",
        name: "Okazaki Park Pond",
        state: "unconfirmed",
        reason: "no-match",
        shiftMeters: null,
      }),
    ]);

    expect(confirmed).toMatchObject({
      id: "places-confirmed",
      passed: true,
      threshold: MIN_SHARE_PLACES_CONFIRMED,
    });
    expect(confirmed?.value).toBeCloseTo(2 / 3, 10);
    expect(confirmed?.findings).toEqual(['stop-2:a1 "Okazaki Park Pond" unconfirmed, no-match']);
  });

  it("fails a day whose largest shift says the model guessed its coordinates", () => {
    const { shift } = resultsOf([
      recordOf({ shiftMeters: 640 }),
      recordOf({ id: "stop-1:p", shiftMeters: 260 }),
    ]);

    expect(shift).toMatchObject({
      id: "provider-shift",
      value: 640,
      passed: false,
      threshold: MAX_PROVIDER_SHIFT_METERS,
    });
    expect(shift?.findings).toEqual([
      'stop-0:p "Honen-in" moved 640 m by the provider',
      'stop-1:p "Honen-in" moved 260 m by the provider',
    ]);
  });

  it("fails the wait when the close waited the whole deadline", () => {
    expect(resultsOf([recordOf({})], DEADLINE_MS).wait).toMatchObject({
      id: "places-wait",
      passed: false,
      findings: [`the close waited the whole ${DEADLINE_MS} ms for the last checks`],
    });
    expect(resultsOf([recordOf({})], 412).wait).toMatchObject({
      value: 412,
      passed: true,
      findings: [],
    });
  });

  it("has nothing to get wrong on a day with no place checked", () => {
    const { confirmed, shift } = resultsOf([]);

    expect(confirmed).toMatchObject({ value: 1, passed: true, findings: [] });
    expect(shift).toMatchObject({ value: 0, passed: true });
  });
});
