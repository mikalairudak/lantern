import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { START_PLACE_CHECKS } from "@/lib/days/written/checks";
import { PORTO_START_DAY } from "@/lib/days/written/porto";
import type { PlaceCheck as VerifierResult } from "@/lib/places/verify-place";
import type { PartialDay } from "./outcome";
import { readyPlacesIn } from "./place-checks";
import { RECORDED_CHECK_MS, recordedVerifierOf } from "./written-place-checks";

const CITY = PORTO_START_DAY.request.city;
const CHECKS = START_PLACE_CHECKS[CITY] ?? {};
const PLACES = readyPlacesIn(PORTO_START_DAY.day as PartialDay, new Set());

function placeWithId(id: string) {
  const ready = PLACES.find((each) => each.id === id);
  if (ready === undefined) throw new Error(`No place ${id} in Porto's day`);
  return ready.place;
}

describe("recordedVerifierOf", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`answers a place with the check its run recorded, ${RECORDED_CHECK_MS} ms after it is asked`, async () => {
    const verifier = recordedVerifierOf(PORTO_START_DAY.day, CHECKS, CITY);
    let answer: VerifierResult | null = null;
    void verifier.verify(placeWithId("stop-0:p"), { city: CITY }).then((check) => {
      answer = check;
    });

    await vi.advanceTimersByTimeAsync(RECORDED_CHECK_MS - 1);
    expect(answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toEqual(CHECKS["stop-0:p"]);
  });

  it("answers a place its run has no check for as not checked, and stops when the stream does", async () => {
    const verifier = recordedVerifierOf(PORTO_START_DAY.day, CHECKS, CITY);
    const elsewhere = { ...placeWithId("stop-0:p"), name: "A place Porto's day never named" };
    const unknown = verifier.verify(elsewhere, { city: CITY });
    const stopping = new AbortController();
    const stopped = verifier.verify(placeWithId("stop-1:p"), { city: CITY }, stopping.signal);

    stopping.abort();
    await vi.advanceTimersByTimeAsync(RECORDED_CHECK_MS);

    await expect(unknown).resolves.toEqual({ kind: "unverified", reason: "failed" });
    await expect(stopped).resolves.toEqual({ kind: "unverified", reason: "aborted" });
  });
});
