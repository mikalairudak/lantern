import { describe, expect, it } from "vitest";
import { NO_CHECKS } from "@/features/itinerary/use-day-stream";
import { normalizedDayOf } from "@/lib/days/written/days";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import type { DayOutcome, PartialDay } from "@/lib/stream/outcome";
import {
  shownDayOf,
  wholeInPlaceOf,
  type DaySources,
  type EndedDay,
  type StreamFrame,
} from "./shown-day";

const ITINERARY = normalizedDayOf(KANAZAWA_START_DAY).itinerary;
/** The whole day as the stream sends it: its header and its stops, so it has begun. */
const WHOLE_FRAME: PartialDay = KANAZAWA_START_DAY.day;
/** A frame from before the stops: the line about the day only. */
const EARLY_FRAME: PartialDay = { dek: KANAZAWA_START_DAY.day.dek };

/** A day as it ended, its own objects, so each test can tell which source drew it. */
function endedDay(): EndedDay {
  return { outcome: { kind: "complete", itinerary: ITINERARY }, checks: {} };
}

function streamOf(frame: Partial<StreamFrame> = {}): StreamFrame {
  return {
    partial: WHOLE_FRAME,
    outcome: null,
    checks: {},
    isStreaming: true,
    held: null,
    ...frame,
  };
}

const NOTHING: DaySources = { merged: null, kept: null, whole: null, stream: null, held: null };

describe("shownDayOf", () => {
  it("draws a merged day as it ended, over the stream's frame it was merged into", () => {
    const merged = endedDay();
    const stream = streamOf({ isStreaming: false, outcome: { kind: "unavailable" } });

    const shown = shownDayOf({ ...NOTHING, merged, stream });

    expect(shown.outcome).toBe(merged.outcome);
    expect(shown.checks).toBe(merged.checks);
    expect(shown.partial).toBe(stream.partial);
    expect(shown).toMatchObject({ isStreaming: false, isFromStream: true });
  });

  it("draws a kept day as it ended, with nothing streaming, whatever the stream holds", () => {
    const kept = endedDay();

    const shown = shownDayOf({ ...NOTHING, kept, stream: streamOf() });

    expect(shown.outcome).toBe(kept.outcome);
    expect(shown.checks).toBe(kept.checks);
    expect(shown).toMatchObject({ partial: null, isStreaming: false, isFromStream: false });
  });

  it("draws a whole day as it is, by the outcome the page made for it", () => {
    const whole = endedDay();

    const shown = shownDayOf({ ...NOTHING, whole, stream: streamOf() });

    expect(shown.outcome).toBe(whole.outcome);
    expect(shown.checks).toBe(whole.checks);
    expect(shown).toMatchObject({ partial: null, isStreaming: false, isFromStream: false });
  });

  it("draws the stream once it has taken the run's request", () => {
    const outcome: DayOutcome = { kind: "complete", itinerary: ITINERARY };
    const stream = streamOf({ outcome, isStreaming: false });

    const shown = shownDayOf({ ...NOTHING, stream });

    expect(shown.partial).toBe(stream.partial);
    expect(shown.outcome).toBe(outcome);
    expect(shown.checks).toBe(stream.checks);
    expect(shown).toMatchObject({ isStreaming: false, isFromStream: true });
  });

  it("holds the stream's last frame while the day is asked for again, until it has begun", () => {
    const lastFrame: PartialDay = { ...WHOLE_FRAME };
    const askedAgain = streamOf({ partial: EARLY_FRAME, held: lastFrame });
    const begun = streamOf({ partial: WHOLE_FRAME, held: lastFrame });

    expect(shownDayOf({ ...NOTHING, stream: askedAgain }).partial).toBe(lastFrame);
    expect(shownDayOf({ ...NOTHING, stream: begun }).partial).toBe(WHOLE_FRAME);
  });

  it("draws the held day while another request streams, still", () => {
    const held = { partial: WHOLE_FRAME, outcome: endedDay().outcome, checks: {} };

    const shown = shownDayOf({ ...NOTHING, held });

    expect(shown.partial).toBe(held.partial);
    expect(shown.outcome).toBe(held.outcome);
    expect(shown.checks).toBe(held.checks);
    expect(shown).toMatchObject({ isStreaming: false, isFromStream: false });
  });

  it("with nothing yet, waits for the stream to take the run's request", () => {
    expect(shownDayOf(NOTHING)).toEqual({
      partial: null,
      outcome: null,
      checks: NO_CHECKS,
      isStreaming: true,
      isFromStream: false,
    });
  });
});

describe("wholeInPlaceOf", () => {
  const OWN = { itinerary: ITINERARY, checks: NO_CHECKS };
  const ENDINGS_WITHOUT_THE_DAY: readonly DayOutcome[] = [
    { kind: "cut", itinerary: null },
    { kind: "cut", itinerary: ITINERARY },
    { kind: "disconnected", itinerary: null },
    { kind: "disconnected", itinerary: ITINERARY },
    { kind: "refused" },
    { kind: "invalid", reason: "the day did not read", isEmpty: false },
    { kind: "invalid", reason: "no stops", isEmpty: true },
    { kind: "unavailable" },
    { kind: "limited" },
  ];

  it.each(ENDINGS_WITHOUT_THE_DAY.map((outcome) => [outcome.kind, outcome] as const))(
    "draws the page's own day whole in place of a play that ended %s",
    (_kind, outcome) => {
      expect(wholeInPlaceOf(outcome, OWN)).toBe(OWN);
    },
  );

  it("leaves a play still writing, or landed complete, as it is", () => {
    expect(wholeInPlaceOf(null, OWN)).toBeNull();
    expect(wholeInPlaceOf({ kind: "complete", itinerary: ITINERARY }, OWN)).toBeNull();
  });

  it("leaves the ending of a day that is not the page's own", () => {
    expect(wholeInPlaceOf({ kind: "disconnected", itinerary: null }, null)).toBeNull();
  });
});
