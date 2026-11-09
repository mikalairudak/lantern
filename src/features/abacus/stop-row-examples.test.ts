import { describe, expect, it } from "vitest";
import {
  STOP_ROW_EXAMPLES,
  STOP_ROW_STATES,
  stillOf,
  type StopRowState,
} from "./stop-row-examples";

/** The states found in the stream, before the day is complete. */
const PARTIAL_STATES = STOP_ROW_STATES.slice(
  0,
  STOP_ROW_STATES.findIndex(({ key }) => key === "complete"),
).map(({ key }) => key);

describe("the stop row's examples", () => {
  it.each(STOP_ROW_EXAMPLES.map((example) => [example.label, example] as const))(
    "shows %s in every state, between at most one stop either side",
    async (_label, example) => {
      for (const { key } of STOP_ROW_STATES) {
        const { draft, subject } = await stillOf(example, key);
        expect(draft.stops[subject]?.id).toBe(`stop-${example.stop}`);
        expect(draft.stops.length).toBeLessThanOrEqual(3);
      }
    },
  );

  it.each(STOP_ROW_EXAMPLES.map((example) => [example.label, example] as const))(
    "finds each moment of %s later in its stream than the one before",
    async (_label, example) => {
      const stills = await Promise.all(PARTIAL_STATES.map((key) => stillOf(example, key)));
      const offsets = stills.map(({ at }) => at ?? Infinity);

      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    },
  );

  it("writes a row's name, then its energy, then its versions, as the stream does", async () => {
    const [example] = STOP_ROW_EXAMPLES;
    if (!example) throw new Error("No examples");
    const stopIn = async (key: StopRowState) => {
      const { draft, subject } = await stillOf(example, key);
      return draft.stops[subject];
    };

    expect((await stopIn("placed"))?.primary.name).toBeUndefined();
    expect((await stopIn("naming"))?.primary.name?.length).toBeGreaterThanOrEqual(6);
    expect((await stopIn("unweighed"))?.primary.sensory?.energy).toBeUndefined();
    // Weighed, its frame comes after the one it is drawn from, whose bead was hollow.
    const weighing = await stillOf(example, "weighing");
    expect(weighing.draft.stops[weighing.subject]?.primary.sensory?.energy).toBeDefined();
    expect(weighing.before?.stops[weighing.subject]?.primary.sensory?.energy).toBeUndefined();
    const written = await stopIn("written");
    expect(written?.primary.sensory?.energy).toBeDefined();
    expect(written?.alternatives).toHaveLength(0);
    expect((await stopIn("complete"))?.alternatives.length).toBeGreaterThan(0);
  });

  it("reads each example once, whatever density shows it", () => {
    const [example] = STOP_ROW_EXAMPLES;
    if (!example) throw new Error("No examples");

    expect(stillOf(example, "complete")).toBe(stillOf(example, "complete"));
  });

  it.each(STOP_ROW_EXAMPLES.map((example) => [example.label, example] as const))(
    "frames %s on its rows' own hours in every state, with no waiting line",
    async (_label, example) => {
      for (const { key } of STOP_ROW_STATES) {
        expect((await stillOf(example, key)).frame).toEqual({ kind: "own" });
      }
    },
  );
});
