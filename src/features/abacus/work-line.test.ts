// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER,
  ELCHE_LATE_DINNER_UNREPEATED,
} from "@/lib/fixtures/replan/elche-dinner";
import { mergeShownReplan } from "@/lib/replan/merge";
import type { GeneratedReplan } from "@/lib/schema/replan.schema";
import { readReplanStream } from "@/lib/stream/read-replan-stream";
import { replanFrameOf, type ReplanFrame } from "./replan-frame";
import {
  hourOf,
  partMomentOf,
  receiptOf,
  workLineOf,
  type WorkChange,
  type WorkMoment,
} from "./work-line";

const LATE_DINNER: WorkChange = {
  word: "dinner",
  from: "early dinner",
  isFromAsked: false,
  toValue: "late",
  to: "eating late",
};

const FAMILY: WorkChange = {
  word: "company",
  from: "with …?",
  isFromAsked: true,
  toValue: "family",
  to: "with family",
};

/** What a phone's line holds of the words and their count, beside the fork row's time. */
const PHONE_WORDS_CHARS = 45;

/** The line's words and count as read, "words · count". */
function said(change: WorkChange, reach: "part" | "whole", moment: WorkMoment): string {
  const line = workLineOf(change, reach, moment);
  return [line.words, line.count].filter(Boolean).join(" · ");
}

/** The re-plan's text sent a few letters at a time, as a model streams it, ending whole. */
function streamOf(replan: GeneratedReplan): Response {
  const text = JSON.stringify(replan);
  const deltas: string[] = [];
  for (let from = 0; from < text.length; from += 4) deltas.push(text.slice(from, from + 4));
  const events = [
    ...deltas.map((delta) => ({ type: "text-delta", id: "t", delta })),
    { type: "finish", finishReason: "stop" },
  ];
  const body = [...events.map((event) => JSON.stringify(event)), "[DONE]"]
    .map((line) => `data: ${line}\n\n`)
    .join("");
  return new Response(body);
}

async function framesOf(replan: GeneratedReplan): Promise<ReplanFrame[]> {
  const frames: ReplanFrame[] = [];
  await readReplanStream({
    basis: ELCHE_DINNER_BASIS,
    response: Promise.resolve(streamOf(replan)),
    onPartial: (partial) => frames.push(replanFrameOf(ELCHE_DINNER_BASIS, partial)),
  });
  return frames;
}

describe("workLineOf", () => {
  it("says what a time word looks for, then counts what lands, its versions and its line", () => {
    expect(said(LATE_DINNER, "part", { kind: "looking" })).toBe("Looking for a dinner after nine");
    expect(said(LATE_DINNER, "part", { kind: "stops", written: 2 })).toBe(
      "Writing the new stops · 2 so far",
    );
    expect(said(LATE_DINNER, "part", { kind: "versions", written: 1, of: 4 })).toBe(
      "Writing their versions · 1 of 4",
    );
    expect(said(LATE_DINNER, "part", { kind: "dek" })).toBe("Writing the line about the day");
    // While it writes, the light runs through the line; the fork row is its way, not the line.
    const writing = workLineOf(LATE_DINNER, "part", { kind: "looking" });
    expect(writing).toEqual({
      words: "Looking for a dinner after nine",
      count: null,
      isWorking: true,
    });
  });

  it("writes a whole day for a word", () => {
    expect(said(FAMILY, "whole", { kind: "looking" })).toBe("Writing the day again, for a family");
    expect(said(FAMILY, "whole", { kind: "stops", written: 5 })).toBe("Writing the day · 5 so far");
  });

  it("says why one ended without a proposal, in the words the page gives it, unlit", () => {
    const failed = workLineOf(LATE_DINNER, "part", {
      kind: "failed",
      said: "The new dinner didn't fit",
    });
    expect(failed).toEqual({ words: "The new dinner didn't fit", count: null, isWorking: false });
  });

  it("keeps every line to a phone's beside the fork row's time", () => {
    const words = [
      { word: "start", values: ["early", "slow"], from: "early start" },
      { word: "dinner", values: ["early", "late"], from: "early dinner" },
      { word: "end", values: ["evening", "early", "late"], from: "home by eleven" },
      { word: "company", values: ["alone", "partner", "family", "friends"], from: "with …?" },
    ] as const;
    const moments: WorkMoment[] = [
      { kind: "looking" },
      { kind: "stops", written: 12 },
      { kind: "versions", written: 12, of: 12 },
      { kind: "dek" },
    ];
    const told = words.flatMap(({ word, values, from }) =>
      values.flatMap((toValue) =>
        (["part", "whole"] as const).flatMap((reach) =>
          moments.map((moment) => {
            const change = { word, from, isFromAsked: from.endsWith("?"), toValue, to: from };
            return said(change, reach, moment);
          }),
        ),
      ),
    );

    expect(told.filter((line) => line.length > PHONE_WORDS_CHARS)).toEqual([]);
  });
});

describe("hourOf", () => {
  const merged = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
  if (!merged.ok) throw new Error(merged.reason);
  const stops = merged.itinerary.stops;

  it("reads the hour each time word sets on Elche's proposal: dinner at nine, home at a quarter to midnight", () => {
    expect(hourOf("dinner", stops)).toBe(21 * 60);
    expect(hourOf("start", stops)).toBe(7 * 60 + 45);
    expect(hourOf("end", stops)).toBe(23 * 60 + 45);
    expect(hourOf("company", stops)).toBeNull();
  });
});

describe("receiptOf", () => {
  const merged = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
  if (!merged.ok) throw new Error(merged.reason);
  const before = ELCHE_DINNER_BASIS.itinerary.stops;
  const after = merged.itinerary.stops;
  const counts = (added: number, later = 0, earlier = 0) => ({ added, same: null, later, earlier });

  it("says what Elche's proposal would change, against the day on screen, and where its end moves", () => {
    expect(receiptOf(LATE_DINNER, "part", before, after, counts(3))).toEqual({
      words: "Dinner 21:00, not 18:15 · 3 new stops",
      end: "ends 23:45, not 20:45",
    });
    // Taken, the day before beside it says its own hours, with no count.
    expect(receiptOf({ word: "dinner", to: "early dinner" }, "part", after, before, null)).toEqual({
      words: "Dinner 18:15, not 21:00",
      end: "ends 20:45, not 23:45",
    });
  });

  it("tells a part's stops at new places from its own places moved, and which way they went", () => {
    const words = (added: number, later: number, earlier: number) =>
      receiptOf(LATE_DINNER, "part", before, after, counts(added, later, earlier)).words;

    // Kanazawa's late dinner: two new places, and its oden at a later hour.
    expect(words(2, 1, 0)).toBe("Dinner 21:00, not 18:15 · 2 new stops, 1 later");
    expect(words(0, 2, 0)).toBe("Dinner 21:00, not 18:15 · 2 stops later");
    expect(words(0, 0, 1)).toBe("Dinner 21:00, not 18:15 · 1 stop earlier");
    expect(words(1, 1, 1)).toBe("Dinner 21:00, not 18:15 · 1 new stop, 2 moved");
    expect(words(0, 0, 0)).toBe("Dinner 21:00, not 18:15 · the same stops");
  });

  it("says an hour once where both versions keep it, and the end word's own end once", () => {
    expect(receiptOf(LATE_DINNER, "part", after, after, counts(1)).words).toBe(
      "Dinner at 21:00 · 1 new stop",
    );
    expect(receiptOf({ word: "end", to: "out late" }, "part", before, after, null)).toEqual({
      words: "Ends 23:45, not 20:45",
      end: null,
    });
  });

  it("names a whole day by its answer, and counts its places new and the same", () => {
    const whole = (added: number, same: number) =>
      receiptOf(FAMILY, "whole", before, before, { added, same, later: 0, earlier: 0 }).words;

    expect(whole(3, 5)).toBe("With family · 3 new stops, 5 the same");
    expect(whole(0, 8)).toBe("With family · the same eight stops");
  });
});

describe("partMomentOf", () => {
  it("tells Elche's re-plan from its rows: looking, three new stops, four versions, its line", async () => {
    const frames = await framesOf(ELCHE_LATE_DINNER_UNREPEATED);
    const told = frames
      .map((frame) => said(LATE_DINNER, "part", partMomentOf(frame)))
      .filter((line, at, all) => line !== all[at - 1]);

    expect(told).toEqual([
      "Looking for a dinner after nine",
      "Writing the new stops · 1 so far",
      "Writing the new stops · 2 so far",
      "Writing the new stops · 3 so far",
      // The set being written counts, so the last is said before the line about the day.
      "Writing their versions · 2 of 4",
      "Writing their versions · 3 of 4",
      "Writing their versions · 4 of 4",
      // The last set is whole as the line about the day begins, so the line says that next.
      "Writing the line about the day",
    ]);
    // Its words change three times while it writes; between them only the count does.
    const words = told.map((line) => line.split(" · ")[0]);
    expect(new Set(words).size).toBe(4);
  });

  it("knows a re-plan is lost once a whole new stop repeats a kept place", async () => {
    const frames = await framesOf(ELCHE_LATE_DINNER);
    const lostAt = frames.findIndex((frame) => frame.isLost);

    expect(lostAt).toBeGreaterThan(0);
    expect(frames.slice(lostAt).every((frame) => frame.isLost)).toBe(true);
    // The coffee repeats the morning's: lost before its versions and its line are written.
    expect(frames[lostAt]?.writing).toBe("stops");
    expect((await framesOf(ELCHE_LATE_DINNER_UNREPEATED)).some((frame) => frame.isLost)).toBe(
      false,
    );
  });
});
