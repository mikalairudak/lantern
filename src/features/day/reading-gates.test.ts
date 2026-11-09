import { describe, expect, it } from "vitest";
import { enteredOf, versionsWrittenOf } from "./reading-gates";

const STOPS = ["stop-0", "stop-1", "stop-2", "stop-3"].map((id) => ({ id }));

describe("what the list to read lets in", () => {
  it("lets in the first stops that are whole, up to the first that is not", () => {
    expect(enteredOf(STOPS, new Set(["stop-0", "stop-1"]))).toBe(2);
    // A later stop whole before an earlier one waits for it: the list never skips a stop.
    expect(enteredOf(STOPS, new Set(["stop-0", "stop-2"]))).toBe(1);
    expect(enteredOf(STOPS, new Set(STOPS.map(({ id }) => id)))).toBe(4);
    expect(enteredOf(STOPS, new Set())).toBe(0);
  });

  it("says a stop's versions once the next set has begun, whatever stop that set is for", () => {
    // The model wrote the third stop's set, then the first's, and is writing the second's.
    const sets = [{ stopIndex: 2 }, { stopIndex: 0 }, { stopIndex: 1, options: [] }];
    expect([...versionsWrittenOf(STOPS, sets, false)]).toEqual(["stop-2", "stop-0"]);
    // A set whose stop is not yet written names none.
    expect([...versionsWrittenOf(STOPS, [{}, { stopIndex: 1 }], false)]).toEqual([]);
    expect(versionsWrittenOf(STOPS, undefined, false).size).toBe(0);
  });

  it("says every stop's versions, none among them, once the day is complete", () => {
    expect(versionsWrittenOf(STOPS, [{ stopIndex: 0 }], true).size).toBe(4);
  });
});
