// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { goldenLinesOf, passesAll, voiceLineOfGolden, voiceLinesOf, VOICE_ROLES } from "./lines";

const GOLDEN = goldenLinesOf(
  readFileSync(new URL("../../lib/fixtures/voice/golden-lines.jsonl", import.meta.url), "utf8"),
);

function kanazawa(): Itinerary {
  const normalized = normalizeDay(KANAZAWA_START_DAY.request, KANAZAWA_START_DAY.day);
  if (!normalized.ok) throw new Error(normalized.reason);
  return normalized.itinerary;
}

describe("voiceLinesOf", () => {
  it("reads the line about the day, three lines a place and a reason an alternative", () => {
    const itinerary = kanazawa();
    const lines = voiceLinesOf("day-001", itinerary);
    const places = itinerary.stops.reduce((sum, stop) => sum + 1 + stop.alternatives.length, 0);
    const alternatives = itinerary.stops.reduce((sum, stop) => sum + stop.alternatives.length, 0);
    const count = (role: string) => lines.filter((line) => line.role === role).length;

    expect(count("dek")).toBe(1);
    expect([count("summary"), count("texture"), count("light")]).toEqual([places, places, places]);
    expect(count("reason")).toBe(alternatives);
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
  });

  it("reads the day the visitor sees: a version the normalizer dropped is not judged", () => {
    // Kanazawa's model wrote four versions past the walk from their stops (`day-draft.test.ts`).
    const lines = voiceLinesOf("day-001", kanazawa());

    expect(lines.some((line) => line.place === "Kanazawa Station Museum Area")).toBe(false);
  });

  it("names each line by its day, place and role, and says nothing of who wrote it", () => {
    const [dek, summary] = voiceLinesOf("day-007", kanazawa());

    expect(dek).toMatchObject({ id: "day-007/dek", role: "dek", place: "", time: "" });
    expect(summary).toMatchObject({
      id: "day-007/stop-0:p/summary",
      group: "day-007",
      place: "Kenroku-en",
      time: "07:30",
      isAlternative: false,
    });
  });
});

describe("the judge's labelled lines", () => {
  const ofSet = (set: string) => GOLDEN.filter((line) => line.set === set);
  const failing = (set: string) => ofSet(set).filter((line) => !passesAll(line.verdict));

  // `docs/voice.md`: the curated days as judged on 9045e49, titles aside, under rulings 1 to
  // 11; every line rewritten after, which passes; and the first hand-written day, Alicante's.
  it("hold the passes the rubric judged, with the fails it named", () => {
    expect([ofSet("curated").length, failing("curated").length]).toEqual([243, 14]);
    expect([ofSet("rewritten").length, failing("rewritten").length]).toEqual([14, 0]);
    expect([ofSet("first-pass").length, failing("first-pass").length]).toEqual([77, 12]);
  });

  it("say why each failing line fails, and nothing for a line that passes", () => {
    for (const line of GOLDEN) expect(line.why === "").toBe(passesAll(line.verdict));
  });

  it("cover every role, each line once", () => {
    expect(new Set(GOLDEN.map((line) => line.role))).toEqual(new Set(VOICE_ROLES));
    expect(new Set(GOLDEN.map((line) => line.id)).size).toBe(GOLDEN.length);
  });

  it("are read by the judge a judged day at a time, the pass and day as the group", () => {
    const line = voiceLineOfGolden(failing("curated")[0]!);

    expect(line.group).toMatch(/^curated:(Kyoto|Alicante|Lisbon)$/);
    expect(line.text).not.toBe("");
  });
});
