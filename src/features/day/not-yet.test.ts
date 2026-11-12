import { describe, expect, it } from "vitest";
import { ELCHE_ITINERARY, ELCHE_REQUEST } from "@/lib/fixtures/replan/elche-dinner";
import { START_DAYS } from "@/lib/days/written/start-days";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { replanPlanOf } from "@/lib/replan/windows";
import {
  ASSUMABLE_FACT_KEYS,
  FACT_KEYS,
  type DayRequest,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import { FACT_OPTIONS } from "./facts";
import {
  REPICKS_AT_ONCE,
  KEEPS_EVERY_STOP,
  WHOLE_DAY_AGAIN,
  answerReachOf,
  forecastOf,
  forkNoteOf,
  partsInWindowsOf,
  seeItAtOf,
  type ForkNoteInput,
  replanEndedOf,
  replanningOf,
  replanningPartOf,
  replanningReachOf,
} from "./not-yet";
import { replannedRequestOf } from "./replan-request";
import { sentenceFactsOf, type SentenceFacts } from "./sentence";

describe("replanningPartOf", () => {
  it("names the part of the day a time word rewrites alone", () => {
    expect(replanningPartOf("slow morning", "start")).toBe("re-planning the morning");
    expect(replanningPartOf("eating late", "dinner")).toBe("re-planning dinner");
    expect(replanningPartOf("out late", "end")).toBe("re-planning the evening");
  });

  it("says the stops travel or company rewrite, with the word, shorter than the whole day's line", () => {
    const said = replanningPartOf("with family", "company");
    expect(said).toBe("re-planning stops for “with family”");
    expect(said.length).toBeLessThan(replanningOf("with family").length);
  });
});

/** The work line's words at a phone's width, as `work-line.test.ts` holds every line to. */
const PHONE_WORDS_CHARS = 45;
const ENDINGS = ["unavailable", "limited", "refused", "invalid", "cut", "disconnected"] as const;

describe("replanEndedOf", () => {
  it("says why a re-plan ended without a proposal, the part a time word rewrote named", () => {
    expect(replanEndedOf("unavailable", "dinner", "part")).toBe("Couldn't re-plan just now");
    expect(replanEndedOf("limited", "end", "part")).toBe("No more re-plans for now");
    expect(replanEndedOf("refused", "start", "part")).toBe("Can't re-plan the morning");
    expect(replanEndedOf("invalid", "end", "part")).toBe("The new evening didn't fit");
    expect(replanEndedOf("invalid", "company", "whole")).toBe("Couldn't finish the new day");
    // Travel and company rewrite stops no part of the day names.
    expect(replanEndedOf("refused", "travel", "part")).toBe("Can't re-plan the stops");
    expect(replanEndedOf("invalid", "company", "part")).toBe("The new stops didn't fit");
    expect(replanEndedOf("cut", "dinner", "part")).toBe("Lantern stopped part-way");
    expect(replanEndedOf("disconnected", "travel", "whole")).toBe("The connection dropped");
  });

  it("gives each reason its own words, every one a phone's line", () => {
    const said = ASSUMABLE_FACT_KEYS.flatMap((word) =>
      (["part", "whole"] as const).flatMap((reach) =>
        ENDINGS.map((ending) => replanEndedOf(ending, word, reach)),
      ),
    );

    expect(said.filter((line) => line.length > PHONE_WORDS_CHARS)).toEqual([]);
    expect(new Set(ENDINGS.map((ending) => replanEndedOf(ending, "dinner", "part"))).size).toBe(
      ENDINGS.length,
    );
  });
});

/** What a day written to its end says Lantern assumed, as the page reads it. */
function assumptionsOf(itinerary: Itinerary): PartialDay["assumptions"] {
  return Object.fromEntries(
    ASSUMABLE_FACT_KEYS.map((key) => [
      key,
      itinerary.facts[key].source === "assumed" ? itinerary.facts[key].value : null,
    ]),
  );
}

interface ShownDay {
  city: string;
  day: Itinerary;
  request: DayRequest;
  facts: SentenceFacts;
}

/** Each of the six starts' days as its page shows it, written to its end. */
const SHOWN_DAYS: readonly ShownDay[] = START_DAYS.map(({ request, day }) => {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(`${request.city}'s day normalizes`);
  const itinerary = normalized.itinerary;
  return {
    city: request.city,
    day: itinerary,
    request,
    facts: sentenceFactsOf(request, assumptionsOf(itinerary)),
  };
});

const HALF_A_MINUTE = " · about\u00A0half\u00A0a\u00A0minute";

/**
 * Every answer of the six starts' days that rewrites part of the day, as the route's plan
 * reads it, and the line it says; every other answer writes the whole day again, re-picks
 * the energy at once, or is the word's own.
 */
const PART_LINES: Readonly<Record<string, string>> = {
  "Bologna start early": "a proposal for the morning",
  "Bologna dinner early": "a proposal for dinner",
  "Bologna end early": "a proposal for the snack and dinner",
  "Bologna end evening": "a proposal for the snack and dinner",
  "Porto dinner late": "a proposal for lunch and dinner",
  "Porto end early": "a proposal for dinner",
  "Porto end late": "a proposal for dinner",
  "Kanazawa start slow": "a proposal for the morning",
  "Kanazawa dinner late": "a proposal for dinner and the evening",
  "Kanazawa end evening": "a proposal for the evening",
  "Kanazawa end late": "a proposal for the evening",
  "Madrid start early": "a proposal for the morning and lunch",
  "Madrid dinner early": "a proposal for dinner",
  "Madrid end early": "a proposal for dinner",
  "Madrid end evening": "a proposal for dinner",
  "Utrecht start early": "a proposal for the morning",
  "Utrecht dinner late": "a proposal for dinner and the evening",
  "Utrecht end early": "a proposal for the evening",
  "Utrecht end late": "a proposal for the evening",
  "Nafplio dinner late": "a proposal for dinner and the evening",
  "Nafplio end evening": "a proposal for the afternoon, dinner and the evening",
  "Nafplio end late": "a proposal for the afternoon, dinner and the evening",
  // Company rewrites the runs of the stops it shaped.
  "Bologna company alone": "a proposal for lunch, midday, the snack and dinner",
  "Bologna company partner": "a proposal for lunch, midday, the snack and dinner",
  "Bologna company family": "a proposal for lunch, midday, the snack and dinner",
  "Madrid company alone": "a proposal for lunch and dinner",
  "Madrid company partner": "a proposal for lunch and dinner",
  "Madrid company family": "a proposal for lunch and dinner",
  "Nafplio company alone": "a proposal for the morning, dinner and the evening",
  "Nafplio company family": "a proposal for the morning, dinner and the evening",
  "Nafplio company friends": "a proposal for the morning, dinner and the evening",
};

describe("forecastOf", () => {
  it("says under every answer of every start's day what the route's own plan for it does", () => {
    const parts: string[] = [];
    for (const { city, day, request, facts } of SHOWN_DAYS) {
      for (const key of FACT_KEYS) {
        for (const { value } of FACT_OPTIONS[key]) {
          const line = forecastOf(answerReachOf(day, request, facts, { key, value }));
          const name = `${city} ${key} ${value}`;
          if (facts[key]?.value === value) {
            expect(line, name).toBeNull();
            continue;
          }
          if (key === "energy") {
            expect(line, name).toBe(REPICKS_AT_ONCE);
            continue;
          }
          // The plan the page asks the route for, read here apart from the forecast.
          const plan = replanPlanOf(day, replannedRequestOf(request, facts, { key, value }), key);
          if (plan.kind === "full") {
            expect(line, name).toBe(WHOLE_DAY_AGAIN);
            continue;
          }
          // Travel, and company where no stop names it, change the word alone.
          if (plan.kind === "word") {
            expect(line, name).toBe(KEEPS_EVERY_STOP);
            continue;
          }
          parts.push(name);
          expect(line, name).toBe(`${PART_LINES[name]}${HALF_A_MINUTE}`);
        }
      }
    }
    // None of the table's lines is one no day says.
    expect(parts.toSorted()).toEqual(Object.keys(PART_LINES).toSorted());
  });

  it("counts five parts or more, which would take a third line of a phone's word list", () => {
    const parts = ["the morning", "lunch", "the afternoon", "dinner", "the evening"];

    expect(forecastOf({ kind: "part", parts, at: "13:15" })).toBe(
      `a proposal for five parts of the day${HALF_A_MINUTE}`,
    );
    expect(forecastOf({ kind: "part", parts: parts.slice(0, 4), at: "13:15" })).toBe(
      `a proposal for the morning, lunch, the afternoon and dinner${HALF_A_MINUTE}`,
    );
  });

  it("names every part Elche's dinner rewrites, the lunch the window takes with it", () => {
    const facts = sentenceFactsOf(ELCHE_REQUEST, assumptionsOf(ELCHE_ITINERARY));
    const reach = answerReachOf(ELCHE_ITINERARY, ELCHE_REQUEST, facts, {
      key: "dinner",
      value: "late",
    });

    expect(forecastOf(reach)).toBe(
      `a proposal for lunch, the afternoon, dinner and the evening${HALF_A_MINUTE}`,
    );
    expect(replanningReachOf("eating late", reach)).toBe(
      "re-planning lunch, the afternoon, dinner and the evening",
    );
  });

  it("says the whole day's line while a word that writes the whole day again streams", () => {
    expect(replanningReachOf("with family", { kind: "whole" })).toBe(replanningOf("with family"));
  });

  it("names a part once however many of a window's stops stand for it", () => {
    const bologna = SHOWN_DAYS[0];
    if (!bologna) throw new Error("Bologna is the first written day");
    // Its 21:00 dinner and 23:15 bar are both dinner.
    expect(partsInWindowsOf(bologna.day.stops, [{ from: 5, to: 7 }], "end")).toEqual([
      "the snack",
      "dinner",
    ]);
  });
});

describe("forkNoteOf", () => {
  const FORK: ForkNoteInput = {
    from: "early dinner",
    to: "eating late",
    isWriting: false,
    isReady: false,
    isFailed: false,
    isChosen: false,
    canAskAgain: false,
    reason: null,
  };
  const PARTS = ["lunch", "dinner"];

  it("says what is written and where, its answer quoted, while the proposal is written", () => {
    expect(forkNoteOf({ ...FORK, isWriting: true }, PARTS, "13:15")).toEqual({
      words: "Writing “eating late” for lunch and dinner",
      link: { kind: "see", at: "13:15" },
    });
    expect(seeItAtOf("13:15")).toBe("see it at\u00A013:15");
  });

  it("says the proposal is drawn beside the day once whole, a press away", () => {
    expect(forkNoteOf({ ...FORK, isReady: true }, PARTS, "13:15")).toEqual({
      words: "“eating late” drawn beside lunch and dinner",
      link: { kind: "see", at: "13:15" },
    });
  });

  it("says why the word came back, and offers to ask again where another try might mend it", () => {
    const failed = { ...FORK, isFailed: true, reason: "Couldn't re-plan just now" };
    expect(forkNoteOf({ ...failed, canAskAgain: true }, PARTS, "13:15")).toEqual({
      words: "Couldn't re-plan just now, so “early dinner” stays",
      link: { kind: "ask-again" },
    });
    expect(forkNoteOf({ ...failed, reason: "No more re-plans for now" }, PARTS, "13:15")).toEqual({
      words: "No more re-plans for now, so “early dinner” stays",
      link: null,
    });
  });

  it("counts the parts past four, and names a whole day's proposal with nothing to point to", () => {
    const five = ["breakfast", "the morning", "lunch", "the afternoon", "dinner"];
    expect(forkNoteOf({ ...FORK, isWriting: true }, five, "08:00")?.words).toBe(
      "Writing “eating late” for five parts of the day",
    );
    expect(forkNoteOf({ ...FORK, isWriting: true }, [], null)).toEqual({
      words: "Writing “eating late” for the whole day",
      link: null,
    });
    expect(forkNoteOf({ ...FORK, isReady: true }, [], null)?.words).toBe(
      "“eating late” is written as a whole day",
    );
  });

  it("says nothing once a version is chosen, nor at rest", () => {
    expect(forkNoteOf({ ...FORK, isChosen: true }, PARTS, "13:15")).toBeNull();
    expect(forkNoteOf(FORK, PARTS, "13:15")).toBeNull();
  });
});
