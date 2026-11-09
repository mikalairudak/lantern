import { describe, expect, it } from "vitest";
import {
  GeneratedIntakeSchema,
  type CityReading,
  type GeneratedIntake,
} from "@/lib/schema/intake.schema";
import { DayRequestSchema } from "@/lib/schema/itinerary.schema";
import {
  LATE_DINNER_SAID,
  MAX_CITY_READINGS,
  dateInZone,
  intakeWordsOf,
  normalizeIntake,
  todayIn,
} from "./normalize-intake";

/** Late on the 13th in London, already the 14th in Kyoto. */
const NOW = new Date("2026-11-13T20:00:00Z");
const KYOTO: CityReading = {
  placeId: "kyoto",
  name: "Kyoto",
  region: "Japan",
  timezone: "Asia/Tokyo",
};
const PORTLANDS: CityReading[] = [
  {
    placeId: "portland-or",
    name: "Portland",
    region: "Oregon, United States",
    timezone: "America/Los_Angeles",
  },
  {
    placeId: "portland-me",
    name: "Portland",
    region: "Maine, United States",
    timezone: "America/New_York",
  },
  {
    placeId: "portland-vic",
    name: "Portland",
    region: "Victoria, Australia",
    timezone: "Australia/Melbourne",
  },
  {
    placeId: "portland-dor",
    name: "Portland",
    region: "England, United Kingdom",
    timezone: "Europe/London",
  },
];

/** "A slow Sunday in Kyoto with my partner", as an intake would read it. */
function intakeOf(overrides: Partial<GeneratedIntake> = {}): GeneratedIntake {
  return GeneratedIntakeSchema.parse({
    city: "Kyoto",
    cityReadings: [],
    energy: null,
    energyGuess: "calm",
    travel: null,
    start: "slow",
    dinner: null,
    end: null,
    company: "partner",
    date: null,
    unplaced: [],
    ...overrides,
  });
}

describe("intakeWordsOf", () => {
  it("takes an energy the text names as the visitor's", () => {
    expect(intakeWordsOf(intakeOf({ energy: "social", energyGuess: null }))).toMatchObject({
      energy: "social",
      energySource: "chosen",
    });
  });

  it("takes the energy the text points to as Lantern's", () => {
    expect(intakeWordsOf(intakeOf())).toMatchObject({ energy: "calm", energySource: "assumed" });
  });

  it("assumes the middle energy when nothing in the text points anywhere", () => {
    expect(intakeWordsOf(intakeOf({ energyGuess: null }))).toMatchObject({
      energy: "balanced",
      energySource: "assumed",
    });
  });

  it("keeps a named energy over a guess written beside it", () => {
    expect(intakeWordsOf(intakeOf({ energy: "lively", energyGuess: "calm" }))).toMatchObject({
      energy: "lively",
      energySource: "chosen",
    });
  });

  it("says back a late dinner a time to be home by leaves no room for, once", () => {
    const both = normalizeIntake(intakeOf({ dinner: "late", end: "evening" }), [KYOTO], NOW);
    const saidBack = normalizeIntake(
      intakeOf({ end: "evening", unplaced: ["a late dinner"] }),
      [KYOTO],
      NOW,
    );

    expect(both).toMatchObject({ kind: "request", unplaced: [LATE_DINNER_SAID] });
    expect(both.kind === "request" && both.request.dinner).toBeNull();
    expect(saidBack).toMatchObject({ kind: "request", unplaced: ["a late dinner"] });
  });

  it("keeps a time to be home by over a late dinner it leaves no room for, which goes to Lantern", () => {
    expect(intakeWordsOf(intakeOf({ dinner: "late", end: "evening" }))).toMatchObject({
      dinner: null,
      end: "evening",
    });
    expect(intakeWordsOf(intakeOf({ dinner: "late", end: "early" }))).toMatchObject({
      dinner: "late",
      end: "early",
    });
  });

  it("keeps a date the text names, and drops one that is not a date", () => {
    expect(intakeWordsOf(intakeOf({ date: "2026-11-15" })).date).toBe("2026-11-15");
    expect(intakeWordsOf(intakeOf({ date: "next Sunday" })).date).toBeNull();
    expect(intakeWordsOf(intakeOf({ date: "2026-02-30" })).date).toBeNull();
  });
});

describe("todayIn", () => {
  it("names the date where the city is, not where the visitor is", () => {
    expect(todayIn("Asia/Tokyo", NOW)).toBe("2026-11-14");
    expect(todayIn("Europe/London", NOW)).toBe("2026-11-13");
  });
});

describe("dateInZone", () => {
  const LONDON_TODAY = { date: "2026-11-13", timezone: "Europe/London" };
  const TOKYO_TODAY = { date: "2026-11-14", timezone: "Asia/Tokyo" };

  it("moves today to today in a zone already on the next day, never to yesterday", () => {
    expect(dateInZone(LONDON_TODAY, "Asia/Tokyo", NOW)).toBe("2026-11-14");
  });

  it("moves today to today in a zone still on the day before", () => {
    expect(dateInZone(TOKYO_TODAY, "Europe/London", NOW)).toBe("2026-11-13");
  });

  it("keeps a day the visitor named ahead", () => {
    const saturday = { date: "2026-11-21", timezone: "Europe/London" };

    expect(dateInZone(saturday, "Asia/Tokyo", NOW)).toBe("2026-11-21");
  });

  it("plans a day already over, as on a page left open overnight, for today there", () => {
    const leftOpen = { date: "2026-11-12", timezone: "Asia/Tokyo" };

    expect(dateInZone(leftOpen, "Europe/London", NOW)).toBe("2026-11-13");
  });
});

describe("normalizeIntake", () => {
  it("makes the request from one city, for today there when the text names no day", () => {
    const result = normalizeIntake(intakeOf({ unplaced: ["with my dog"] }), [KYOTO], NOW);

    expect(result).toEqual({
      kind: "request",
      request: {
        city: "Kyoto",
        citySource: "chosen",
        date: "2026-11-14",
        timezone: "Asia/Tokyo",
        energy: "calm",
        energySource: "assumed",
        travel: null,
        start: "slow",
        dinner: null,
        end: null,
        company: "partner",
      },
      readings: [],
      unplaced: ["with my dog"],
    });
    if (result.kind === "request") {
      expect(DayRequestSchema.safeParse(result.request).success).toBe(true);
    }
  });

  it("keeps the day the text names", () => {
    const result = normalizeIntake(intakeOf({ date: "2026-11-15" }), [KYOTO], NOW);

    expect(result.kind === "request" && result.request.date).toBe("2026-11-15");
  });

  it("asks for the city when none was found, the words read waiting for the answer", () => {
    const result = normalizeIntake(intakeOf({ city: null }), [], NOW);

    expect(result).toEqual({
      kind: "question",
      key: "city",
      readings: [],
      words: intakeWordsOf(intakeOf()),
      unplaced: [],
    });
  });

  it("offers a name that fits several cities equally as a few to pick from", () => {
    const result = normalizeIntake(intakeOf({ city: null }), PORTLANDS, NOW);

    expect(result.kind === "question" && result.readings).toEqual(
      PORTLANDS.slice(0, MAX_CITY_READINGS),
    );
  });

  it("plays the likeliest of a shared name as Lantern's, the others offered beside it in order", () => {
    const result = normalizeIntake(intakeOf({ city: "Portland, Oregon" }), PORTLANDS, NOW);

    expect(result.kind).toBe("request");
    if (result.kind !== "request") return;
    expect(result.request).toMatchObject({
      city: "Portland",
      citySource: "assumed",
      timezone: "America/Los_Angeles",
    });
    expect(result.readings).toEqual(PORTLANDS.slice(0, MAX_CITY_READINGS));
  });

  it("plays the city the intake named as the visitor's when no other was found", () => {
    const result = normalizeIntake(intakeOf(), [KYOTO], NOW);

    expect(result.kind === "request" && [result.request.citySource, result.readings]).toEqual([
      "chosen",
      [],
    ]);
  });

  // Live, intake-v2 asked about "Atlantis" with three towns of the name; only Florida's was
  // found, and playing it as the visitor's gave a day for a city no one named.
  it("asks with the one city found when the intake named none, rather than plan its day", () => {
    const result = normalizeIntake(intakeOf({ city: null, cityReadings: ["Kyoto"] }), [KYOTO], NOW);

    expect(result).toEqual({
      kind: "question",
      key: "city",
      readings: [KYOTO],
      words: intakeWordsOf(intakeOf()),
      unplaced: [],
    });
  });

  it("says each unplaced phrase back once, as typed, and no blank ones", () => {
    const result = normalizeIntake(
      intakeOf({ unplaced: [" by bike", "by bike", "", "vegetarian "] }),
      [KYOTO],
      NOW,
    );

    expect(result.kind === "request" && result.unplaced).toEqual(["by bike", "vegetarian"]);
  });

  it("answers as a failed intake when the city found makes no valid request", () => {
    const nowhere: CityReading = { ...KYOTO, timezone: "Japan" };

    expect(normalizeIntake(intakeOf(), [nowhere], NOW)).toEqual({ kind: "unavailable" });
  });
});
