import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { ALICANTE_REQUEST, KYOTO_REQUEST, LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { draftDayOf } from "@/features/abacus/day-draft";
import { labelOf } from "./facts";
import { notReplanningYetOf } from "./not-yet";
import { revealedOf } from "@/features/itinerary/revealed";
import {
  heldBack,
  penPiecesOf,
  requestGistOf,
  requestSentenceOf,
  sentenceFactsOf,
  trailsOf,
  weekdayOf,
  widestClauses,
  type SentenceFacts,
  NO_LOCAL_WORDS,
} from "./sentence";

const KYOTO_STOPS = draftDayOf(revealedOf(KYOTO_DAY.day, null)).stops;

function labels(facts: SentenceFacts): (string | null)[] {
  return Object.values(facts).map((fact) => (fact === null ? null : labelOf(fact)));
}

describe("sentenceFactsOf", () => {
  it("says the visitor's words before the first token and leaves Lantern's places out", () => {
    const facts = sentenceFactsOf(LISBON_REQUEST, undefined);

    expect(labels(facts)).toEqual(["lively", null, null, null, null, "with friends"]);
    expect(facts.company?.source).toBe("chosen");
  });

  it("adds each assumption as it arrives, and the open question as a question", () => {
    const early = sentenceFactsOf(KYOTO_REQUEST, { travel: "on-foot" });
    const all = sentenceFactsOf(KYOTO_REQUEST, KYOTO_DAY.day.assumptions);

    expect(labels(early)).toEqual(["calm", "on foot", null, null, null, null]);
    expect(early.travel?.source).toBe("assumed");
    expect(labels(all)).toEqual([
      "calm",
      "on foot",
      "early start",
      "early dinner",
      "home by eight",
      "with …?",
    ]);
    expect(all.company?.source).toBe("asked");
  });

  it("keeps a word the request gives, whatever the model writes for it", () => {
    const facts = sentenceFactsOf(LISBON_REQUEST, { company: null });

    expect(facts.company).toMatchObject({ value: "friends", source: "chosen" });
  });

  it("says an energy the intake assumed as Lantern's, and a picked one as the visitor's", () => {
    const request = { ...KYOTO_REQUEST, energySource: "assumed" } as const;

    expect(sentenceFactsOf(request, undefined).energy?.source).toBe("assumed");
    const picked = sentenceFactsOf(request, undefined, { ...NO_LOCAL_WORDS, energy: "calm" });
    expect(picked.energy).toMatchObject({ value: "calm", source: "chosen" });
  });

  it("takes the visitor's energy and their confirmed words from the page", () => {
    const facts = sentenceFactsOf(KYOTO_REQUEST, KYOTO_DAY.day.assumptions, {
      energy: "reflective",
      confirmed: ["start"],
      kept: {},
    });

    expect(labelOf(facts.energy!)).toBe("quiet");
    expect(facts.start?.source).toBe("chosen");
    expect(facts.travel?.source).toBe("assumed");
  });
});

describe("trailsOf", () => {
  it("closes a word with a comma only once a word follows it on screen", () => {
    const none = trailsOf(sentenceFactsOf(KYOTO_REQUEST, undefined));
    const two = trailsOf(sentenceFactsOf(KYOTO_REQUEST, { travel: "on-foot", start: "early" }));

    expect(none.city).toBe("");
    expect(two).toMatchObject({ city: ",", travel: ",", start: "", dinner: "" });
  });

  it("closes the city when the visitor's own last word is already there", () => {
    const trails = trailsOf(sentenceFactsOf(LISBON_REQUEST, undefined));

    // Lantern's words are not there yet, so none of their places carries a comma.
    expect(trails).toEqual({
      city: ",",
      travel: "",
      start: "",
      dinner: "",
      end: "",
      company: "",
    });
  });
});

describe("the request said in full", () => {
  it("names the day of the week from the date, in any time zone", () => {
    expect(weekdayOf("2026-11-14")).toBe("Saturday");
  });

  it("says each curated request as a sentence and as a gist after its city", () => {
    expect(requestSentenceOf(KYOTO_REQUEST)).toBe("A calm Saturday in Kyoto");
    expect(requestSentenceOf(LISBON_REQUEST)).toBe("A lively Saturday in Lisbon, with friends");
    expect(requestGistOf(ALICANTE_REQUEST)).toBe("a calm Saturday");
    expect(requestGistOf(LISBON_REQUEST)).toBe("a lively Saturday with friends");
  });
});

describe("notReplanningYetOf", () => {
  it("names what the changed word would have re-planned, in the day's own words", () => {
    expect(notReplanningYetOf("company", KYOTO_STOPS)).toBe(
      "Lantern isn't re-planning days right now, so dinner stays as written",
    );
    expect(notReplanningYetOf("travel", KYOTO_STOPS)).toBe(
      "Lantern isn't re-planning days right now, so the morning and the afternoon stay as written",
    );
  });

  it("names a meal as its row does, a snack with its article", () => {
    // A meal at half past five is the snack its row says, on the day's own clock.
    const early = KYOTO_STOPS.map((stop) =>
      stop.dependsOn?.includes("dinner") ? { ...stop, startTime: "17:30" } : stop,
    );
    expect(notReplanningYetOf("company", early)).toBe(
      "Lantern isn't re-planning days right now, so the snack stays as written",
    );
  });

  it("names the meal the dinner word shapes before dinner's hour by the visitor's word", () => {
    // An early dinner at half past five is the visitor's dinner, though its row says snack.
    const early = KYOTO_STOPS.map((stop) =>
      stop.dependsOn?.includes("dinner") ? { ...stop, startTime: "17:30" } : stop,
    );
    expect(notReplanningYetOf("dinner", early)).toBe(
      "Lantern isn't re-planning days right now, so dinner stays as written",
    );
  });

  it("names a bar's dinner by the meal the visitor's word names", () => {
    // A tapas bar at nine: its row says "bar", and the word changed was the dinner.
    const tapas = KYOTO_STOPS.map((stop) =>
      stop.dependsOn?.includes("dinner")
        ? { ...stop, startTime: "21:00", primary: { ...stop.primary, kind: "bar" as const } }
        : stop,
    );
    expect(notReplanningYetOf("dinner", tapas)).toBe(
      "Lantern isn't re-planning days right now, so dinner stays as written",
    );
  });

  it("speaks of the whole day when no stop says it depends on the word", () => {
    expect(notReplanningYetOf("company", [])).toBe(
      "Lantern isn't re-planning days right now, so the day stays as written",
    );
  });
});

describe("widestClauses", () => {
  it("holds the longest things the curve can say about any day", () => {
    const clauses = widestClauses();

    expect(clauses).toHaveLength(8);
    expect(clauses).toContain("quieter in the morning and livelier in the afternoon");
    expect(clauses).toContain("quieter in the afternoon and livelier in the evening");
    expect(clauses).not.toContain("livelier at lunch");
  });
});

describe("the header's pen", () => {
  const facts = sentenceFactsOf(LISBON_REQUEST, { travel: "transit", start: "slow" });

  it("writes Lantern's words in the sentence's order, then the line about the day", () => {
    expect(penPiecesOf(LISBON_REQUEST, facts, undefined)).toEqual(["travel", "start"]);
    expect(penPiecesOf(LISBON_REQUEST, facts, "The Saturday")).toEqual(["travel", "start", "dek"]);
  });

  it("holds back Lantern's words it has not reached, never the visitor's", () => {
    const shown = heldBack(facts, ["travel"]);

    expect(shown.travel?.value).toBe("transit");
    expect(shown.start).toBeNull();
    expect(shown.company?.value).toBe("friends");
    expect(shown.energy?.value).toBe("lively");
  });

  it("never holds back an energy the intake assumed, which comes with the request", () => {
    const assumed = sentenceFactsOf({ ...LISBON_REQUEST, energySource: "assumed" }, undefined);

    expect(heldBack(assumed, []).energy).toMatchObject({ value: "lively", source: "assumed" });
  });
});
