import { describe, expect, it } from "vitest";
import { MINIMAL_DAY } from "@/lib/fixtures/edge/minimal";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { firstAt, partialAt } from "./stream-frames";

const TEXT = dayText(MINIMAL_DAY.day);
const DEK = MINIMAL_DAY.day.dek;

describe("partialAt", () => {
  it("holds nothing before the stream's first value", async () => {
    expect(await partialAt(TEXT, 0)).toEqual({});
  });

  it("holds what partial JSON makes of the stream so far", async () => {
    const at = TEXT.indexOf(DEK) + "M+ from".length;

    expect((await partialAt(TEXT, at)).dek).toBe("M+ from");
  });

  it("holds the whole day once the stream has ended", async () => {
    expect(await partialAt(TEXT, TEXT.length)).toEqual(MINIMAL_DAY.day);
  });
});

describe("firstAt", () => {
  it("finds the first prefix at which the page can draw a state", async () => {
    const at = await firstAt(TEXT, ({ day }) => (day.dek?.length ?? 0) >= "M+".length);

    // The line about the day shows as it is written, from its second letter on.
    expect(at).toBe(TEXT.indexOf(DEK) + "M+".length);
  });

  it("reads the stream as the page does, so a value shows only once it is final", async () => {
    const at = await firstAt(TEXT, ({ day }) => day.stops?.[0]?.durationMinutes !== undefined);

    // A number is final once the next field has started: 120 is not 1 or 12.
    expect(TEXT.slice(0, at)).toMatch(/"durationMinutes":120,"place":\{$/);
  });

  it("answers the stream's whole length for a state the page never draws", async () => {
    expect(await firstAt(TEXT, ({ day }) => (day.stops?.length ?? 0) > 1)).toBe(TEXT.length);
  });
});
