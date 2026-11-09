import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { MINIMAL_DAY } from "@/lib/fixtures/edge/edge-days";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { ENDING_PRESETS, FRAME_POINTS, framesOf, openPathOf, partialAt } from "./frames";

const KYOTO_TEXT = dayText(KYOTO_DAY.day);

function pointNamed(label: string) {
  const point = FRAME_POINTS.find((each) => each.label === label);
  if (!point) throw new Error(`No frame point "${label}"`);
  return point;
}

async function partialAtPoint(label: string) {
  const at = pointNamed(label).at(KYOTO_TEXT);
  if (at === null) throw new Error(`Kyoto never reaches "${label}"`);
  return partialAt(KYOTO_TEXT, at);
}

describe("the frames of a day", () => {
  it("run from nothing to the whole day, one delta apart", async () => {
    const frames = await framesOf(MINIMAL_DAY.day);
    const text = dayText(MINIMAL_DAY.day);

    expect(frames[0]).toEqual({ at: 0, partial: {} });
    expect(frames.at(-1)).toEqual({ at: text.length, partial: MINIMAL_DAY.day });
    expect(frames.every((frame, i) => i === 0 || frame.at > (frames[i - 1]?.at ?? 0))).toBe(true);
  });
});

describe("the open field", () => {
  it.each<[unknown, (string | number)[]]>([
    [{}, []],
    [{ dek: "Hon" }, ["dek"]],
    [
      { dek: "Honen-in.", stops: [{ startTime: "07:30", durationMinutes: 4 }] },
      ["stops", 0, "durationMinutes"],
    ],
    [{ dek: "x", stops: [] }, ["stops"]],
  ])("of %j is at %j", (partial, path) => {
    expect(openPathOf(partial)).toEqual(path);
  });
});

describe("the moments in a stream", () => {
  it("cut the day's line mid-word", async () => {
    const partial = await partialAtPoint("the day's line, mid-word");
    expect(openPathOf(partial)).toEqual(["dek"]);
    expect(KYOTO_DAY.day.dek.startsWith(partial.dek ?? "")).toBe(true);
    expect(partial.dek).not.toBe(KYOTO_DAY.day.dek);
  });

  it("cut the first name mid-word", async () => {
    const partial = await partialAtPoint("the first name, mid-word");
    expect(openPathOf(partial)).toEqual(["stops", 0, "place", "name"]);
    expect(partial.stops?.[0]?.place?.name).toBe(KYOTO_DAY.day.stops[0]?.place.name.slice(0, 5));
  });

  it("catch a duration with one digit of its number", async () => {
    const partial = await partialAtPoint("a duration still growing");
    expect(openPathOf(partial)).toEqual(["stops", 0, "durationMinutes"]);
    expect(String(partial.stops?.[0]?.durationMinutes)).toHaveLength(1);
  });

  it("reach every stop before any swap", async () => {
    const partial = await partialAtPoint("every stop, no swaps yet");
    expect(partial.stops).toHaveLength(KYOTO_DAY.day.stops.length);
    expect(partial.alternatives).toEqual([]);
  });

  it("end on the whole day", async () => {
    expect(await partialAtPoint("the whole day")).toEqual(KYOTO_DAY.day);
  });
});

describe("the endings", () => {
  it("stop at the scrubbed frame only when they are positioned", () => {
    const at = 1234;
    for (const preset of ENDING_PRESETS) {
      const ending = preset.ending(at);
      expect("at" in ending && ending.at === at).toBe(preset.isPositioned);
    }
  });
});
