import { describe, expect, it } from "vitest";
import { swapSidesOf } from "./itinerary.schema";
import {
  isReplannedBy,
  isStopIndexOf,
  optionIdOf,
  primaryIdOf,
  replannedIdOf,
  stopIdAt,
  stopIndexOfId,
} from "./positions";

describe("a place's id", () => {
  it("is its position in the generation, as every stored day and log holds it", () => {
    expect(stopIdAt(2)).toBe("stop-2");
    expect(primaryIdOf(stopIdAt(2))).toBe("stop-2:p");
    expect(optionIdOf(stopIdAt(2), 0)).toBe("stop-2:a1");
  });

  it("carries a re-plan's round before the generation's own", () => {
    const id = replannedIdOf("r2", primaryIdOf(stopIdAt(1)));

    expect(id).toBe("r2-stop-1:p");
    expect(isReplannedBy("r2", id)).toBe(true);
    expect(isReplannedBy("r1", id)).toBe(false);
    expect(isReplannedBy("r2", "stop-1:p")).toBe(false);
    // A round's prefix is whole: round 1's never claims round 10's places.
    expect(isReplannedBy("r1", replannedIdOf("r10", "stop-1:p"))).toBe(false);
    expect(isReplannedBy("r10", replannedIdOf("r10", "stop-1:p"))).toBe(true);
  });

  it("reads back the stop an id names, and nothing from one that names none", () => {
    expect(stopIndexOfId(stopIdAt(12))).toBe(12);
    expect(stopIndexOfId(primaryIdOf(stopIdAt(2)))).toBe(2);
    expect(stopIndexOfId(optionIdOf(stopIdAt(2), 1))).toBe(2);
    expect(stopIndexOfId(replannedIdOf("r1", stopIdAt(2)))).toBeNull();
    expect(stopIndexOfId("stop-")).toBeNull();
    expect(stopIndexOfId("stop-2x")).toBeNull();
  });

  it("names a set's stop only by one of the day's indexes", () => {
    expect(isStopIndexOf(0, 3)).toBe(true);
    expect(isStopIndexOf(2, 3)).toBe(true);
    expect([3, -1, 1.5].map((index) => isStopIndexOf(index, 3))).toEqual([false, false, false]);
  });
});

describe("swapSidesOf", () => {
  it("gives a version each way, and only the one toward the middle at an end", () => {
    expect(swapSidesOf("balanced")).toEqual([-1, 1]);
    expect(swapSidesOf("reflective")).toEqual([1]);
    expect(swapSidesOf("social")).toEqual([-1]);
  });
});
