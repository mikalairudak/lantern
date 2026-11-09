import { describe, expect, it } from "vitest";
import { PORTO_START_REQUEST } from "@/lib/days/written/quick-starts";
import type { IntakeWords } from "@/lib/schema/intake.schema";
import { requestFor, STAND_IN_ZONE, standInZoneOf, unplacedLineOf } from "./start";

/** Late on 25 October in Porto, already the 26th in Tokyo. */
const NOW = new Date("2026-10-25T22:00:00Z");
/** A visitor's zone, a day ahead of Porto's at `NOW`. */
const TOKYO = "Asia/Tokyo";

/** A text that named nothing but, later, its city. */

const NO_WORDS: IntakeWords = {
  date: null,
  energy: "balanced",
  energySource: "assumed",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

describe("requestFor", () => {
  it("gives a written city named alone its whole written day", () => {
    expect(requestFor(" porto ", NO_WORDS, TOKYO, NOW)).toBe(PORTO_START_REQUEST);
  });

  it("asks for a new day when words were read with a written city", () => {
    const request = requestFor("Porto", { ...NO_WORDS, company: "family" }, TOKYO, NOW);

    // Today in Porto, as for a city chosen from its readings.
    expect(request).toEqual({
      ...NO_WORDS,
      company: "family",
      city: "Porto",
      citySource: "chosen",
      timezone: PORTO_START_REQUEST.timezone,
      date: "2026-10-25",
    });
  });

  it("keeps the words read, with today in the stand-in zone for an unwritten city", () => {
    const words: IntakeWords = {
      ...NO_WORDS,
      energy: "calm",
      energySource: "chosen",
      start: "slow",
    };

    expect(requestFor("Paris", words, TOKYO, NOW)).toEqual({
      ...NO_WORDS,
      energy: "calm",
      energySource: "chosen",
      start: "slow",
      city: "Paris",
      citySource: "chosen",
      // The stand-in zone holds until the resolver knows the city's.
      timezone: TOKYO,
      date: "2026-10-26",
    });
  });

  it("keeps a date the text named", () => {
    expect(requestFor("Paris", { ...NO_WORDS, date: "2026-11-15" }, TOKYO, NOW).date).toBe(
      "2026-11-15",
    );
  });
});

describe("standInZoneOf", () => {
  it("reads a typed city in the visitor's own zone, so the day asked for is today where they are", () => {
    expect(standInZoneOf(TOKYO)).toBe(TOKYO);
    expect(standInZoneOf("America/Argentina/Buenos_Aires")).toBe("America/Argentina/Buenos_Aires");
  });

  it("reads it at UTC, in a city's zone, when the browser names no city's zone or none", () => {
    expect(STAND_IN_ZONE).toBe("Atlantic/Reykjavik");
    for (const zone of ["UTC", "Etc/GMT-3", "", "Mars/Olympus", undefined]) {
      expect(standInZoneOf(zone)).toBe(STAND_IN_ZONE);
    }
  });
});

describe("unplacedLineOf", () => {
  it("says nothing when every phrase found a word", () => {
    expect(unplacedLineOf([])).toBeNull();
  });

  it("quotes the phrases as typed, listed as a sentence", () => {
    expect(unplacedLineOf(["with my dog"])).toBe("Lantern can't plan around “with my dog”.");
    expect(unplacedLineOf(["with my dog", "by bike"])).toBe(
      "Lantern can't plan around “with my dog” and “by bike”.",
    );
    expect(unplacedLineOf(["vegetarian", "with my dog", "by bike"])).toBe(
      "Lantern can't plan around “vegetarian”, “with my dog” and “by bike”.",
    );
  });
});
