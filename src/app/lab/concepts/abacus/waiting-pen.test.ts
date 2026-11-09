import { describe, expect, it } from "vitest";
import { revealDay } from "./stand-in-stream";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { draftDayOf, type StopDraft } from "@/features/abacus/day-draft";
import { budgetAt, offsetsOf } from "./pacing";
import { START, arrivalBoundaries, isSilent, stepPlayback } from "./playback";
import { realisticStreamOf } from "./realistic-stream";
import { ALICANTE_HOURS } from "./request-sentence";
import { generatedDayOf } from "./stream";
import { penOf, phraseOf, rewritingPhraseOf } from "@/features/abacus/waiting-pen";

const GENERATED = generatedDayOf(ABACUS_DAY);
const OFFSETS = offsetsOf(GENERATED);
const FRAME = 1 / 60;

/** The stops on screen at the start of each silence in the realistic stream. */
function stopsAtEachSilence(): StopDraft[][] {
  const stream = realisticStreamOf(GENERATED);
  const boundaries = arrivalBoundaries(OFFSETS);
  const silences: StopDraft[][] = [];
  let playback = START;
  let wasSilent = false;
  for (let seconds = 0; playback.shown < OFFSETS.total; seconds += FRAME) {
    playback = stepPlayback(playback, budgetAt(stream, seconds), seconds, boundaries);
    const isNowSilent = isSilent(playback, seconds, OFFSETS.total);
    if (isNowSilent && !wasSilent) {
      silences.push(draftDayOf(revealDay(GENERATED, playback.shown)).stops);
    }
    wasSilent = isNowSilent;
  }
  return silences;
}

function stop(startTime: string, durationMinutes: number, kind?: "food" | "walk"): StopDraft {
  const primary = { id: `${startTime}:p`, kind };
  return {
    id: startTime,
    startTime,
    durationMinutes,
    primary,
    alternatives: [],
    selectedPlaceId: primary.id,
  };
}

describe("penOf", () => {
  it("starts at the beginning of the day the visitor asked for", () => {
    expect(penOf([], ALICANTE_HOURS)).toEqual({ next: "stop", minutes: 7 * 60 });
  });

  it("follows the end of the last stop", () => {
    expect(penOf([stop("14:00", 105)], ALICANTE_HOURS)).toEqual({ next: "stop", minutes: 945 });
  });

  it("follows a night past midnight on the day's running count", () => {
    const night = [stop("21:00", 105, "food"), stop("23:15", 90)];

    expect(penOf(night, ALICANTE_HOURS)).toEqual({ next: "versions", minutes: 24 * 60 + 45 });
    // A meal past midnight is the late supper its row says, never the next day's breakfast.
    expect(
      phraseOf([stop("22:30", 60), stop("00:15", 45, "food")], penOf([], ALICANTE_HOURS)),
    ).toBe("after a late supper");
  });

  it("expects the other versions once the plan reaches the last hour asked for", () => {
    expect(penOf([stop("21:00", 60)], ALICANTE_HOURS).next).toBe("versions");
    expect(penOf([stop("20:00", 60)], ALICANTE_HOURS).next).toBe("stop");
  });
});

describe("phraseOf", () => {
  it.each([
    [[], "the morning"],
    [[stop("11:00", 60, "walk")], "midday"],
    [[stop("13:00", 120, "walk")], "the afternoon"],
    [[stop("17:00", 90, "walk")], "the evening"],
    [[stop("19:30", 90, "walk")], "late evening"],
    [[stop("08:30", 30, "food")], "after breakfast"],
    [[stop("14:00", 105, "food")], "after lunch"],
    [[stop("19:00", 90, "food")], "after dinner"],
  ])("names what follows %j as %s", (stops, phrase) => {
    expect(phraseOf(stops, penOf(stops, ALICANTE_HOURS))).toBe(phrase);
  });

  it("speaks of the options once the plan is complete", () => {
    const stops = [stop("21:00", 120, "food")];

    expect(phraseOf(stops, penOf(stops, ALICANTE_HOURS))).toBe("other versions");
  });

  it("names each silence of the realistic stream without naming a place", () => {
    const phrases = stopsAtEachSilence().map((stops) =>
      phraseOf(stops, penOf(stops, ALICANTE_HOURS)),
    );
    const names = ABACUS_DAY.stops.flatMap((each) => [
      each.primary.name,
      ...each.alternatives.map((alternative) => alternative.name),
    ]);

    expect(phrases).toEqual(["the morning", "midday", "other versions"]);
    for (const phrase of phrases) {
      expect(names.some((name) => phrase.includes(name))).toBe(false);
    }
  });
});

describe("rewritingPhraseOf", () => {
  const [beach, , , , lunch, , promenade, tapas] = ABACUS_DAY.stops;

  it("names a place to eat or drink by its meal: the tapas bar after nine is dinner", () => {
    // The dinner the visitor's word names, though the bar's row says "bar".
    expect(rewritingPhraseOf(tapas!)).toBe("dinner");
    expect(rewritingPhraseOf(lunch!)).toBe("lunch");
  });

  it("reads a meal past midnight on the day's running clock, as a late supper", () => {
    const supper = { ...lunch!, startTime: "00:30" };
    expect(rewritingPhraseOf(supper, 24 * 60 + 30)).toBe("late supper");
  });

  it("names any other stop by its part of the day", () => {
    expect(rewritingPhraseOf(beach!)).toBe("the morning");
    expect(rewritingPhraseOf(promenade!)).toBe("the afternoon");
  });
});
