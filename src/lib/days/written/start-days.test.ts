import { describe, expect, it } from "vitest";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { escapedLettersIn } from "@/lib/stream/escaped-letters";
import { DayRequestSchema, GeneratedDaySchema } from "@/lib/schema/itinerary.schema";
import { CURATED_REQUESTS } from "@/lib/fixtures/curated/requests";
import {
  WRITTEN_REQUESTS,
  firstStartOf,
  isWrittenRequest,
  shownRequestOf,
  writtenRequestOf,
} from "./requests";
import { shownWrittenDayAt, writtenDayAt, writtenDayFor, writtenDayOn } from "./days";
import { daySlugOf } from "../address";
import { KANAZAWA_START_REQUEST, QUICK_STARTS, START_REQUESTS } from "./quick-starts";
import { START_DAYS } from "./start-days";

// The starts open days the product wrote, kept as written: these hold that each is still a
// day the app reads as it read it then, not that its words meet the voice's rubric.
describe.each(START_DAYS)("the start day in $request.city", ({ request, day }) => {
  it("answers a valid request", () => {
    expect(DayRequestSchema.parse(request)).toEqual(request);
  });

  it("is exactly what the generation schema allows", () => {
    expect(GeneratedDaySchema.parse(day)).toEqual(day);
  });

  it("normalizes, as the route's day would", () => {
    const normalized = normalizeDay(request, day);
    expect(normalized.ok, normalized.ok ? "" : normalized.reason).toBe(true);
  });

  it("spells every letter as a letter, as the reader shows it", () => {
    expect(escapedLettersIn(JSON.stringify(day))).toEqual([]);
  });
});

describe("the quick starts", () => {
  it("offer the days in the order of the start days", () => {
    expect(START_REQUESTS).toEqual(START_DAYS.map(({ request }) => request));
  });

  it("name no city twice, among their own and the cities they write anew", () => {
    const cities = QUICK_STARTS.flatMap(({ request, others }) => [
      request.city,
      ...others.map(({ city }) => city),
    ]);
    expect(new Set(cities).size).toBe(cities.length);
  });

  it("each stand under a country of their own, so no two lines under their words repeat", () => {
    const countries = QUICK_STARTS.map(({ country }) => country);
    expect(new Set(countries).size).toBe(countries.length);
  });

  it("write anew in each of the start's own zone", () => {
    for (const { request, others } of QUICK_STARTS) {
      expect(others.map(({ timezone }) => timezone)).toEqual(others.map(() => request.timezone));
    }
  });
});

describe("the written days", () => {
  it("are the starts' alone: the site offers only days the product wrote", () => {
    expect(WRITTEN_REQUESTS).toEqual(START_REQUESTS);
    for (const request of CURATED_REQUESTS) {
      expect(isWrittenRequest(request)).toBe(false);
      expect(writtenDayFor(request, new Date())).toBeNull();
    }
  });

  it("each have an address of their own", () => {
    const slugs = WRITTEN_REQUESTS.map(daySlugOf);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(WRITTEN_REQUESTS)("find the day written for $city's request", (request) => {
    expect(isWrittenRequest({ ...request })).toBe(true);
    expect(writtenDayFor({ ...request }, new Date())?.request).toEqual(request);
  });

  it("find nothing for a start's request in another of its cities", () => {
    const [italy] = QUICK_STARTS;
    const naples = { ...italy!.request, city: "Naples" };
    expect(isWrittenRequest(naples)).toBe(false);
    expect(writtenDayFor(naples, new Date())).toBeNull();
  });
});

describe("a written day's date", () => {
  // Wednesday 11 November in Tokyo: Kanazawa's Saturday is the 14th.
  const now = new Date("2026-11-11T03:00:00Z");
  const kanazawaOn = (date: string) => ({ ...KANAZAWA_START_REQUEST, date });

  it.each(QUICK_STARTS)("keeps $request.city's first hour as its file writes it", (start) => {
    const written = START_DAYS.find(({ request }) => request === start.request);
    expect(start.firstStart).toBe(written?.day.stops[0]?.startTime);
    expect(firstStartOf(start.request)).toBe(start.firstStart);
  });

  it("moves a written request, word for word, to the date it is shown on, and nothing else", () => {
    expect(shownRequestOf(KANAZAWA_START_REQUEST, now)).toEqual(kanazawaOn("2026-11-14"));
    const lively = { ...KANAZAWA_START_REQUEST, energy: "lively" as const };
    expect(shownRequestOf(lively, now)).toBe(lively);
    const shown = kanazawaOn("2026-11-21");
    expect(shownRequestOf(shown, now)).toBe(shown);
  });

  it("knows a written request on any date of its weekday, without the clock", () => {
    expect(writtenRequestOf(kanazawaOn("2027-02-06"))).toBe(KANAZAWA_START_REQUEST);
    expect(isWrittenRequest(kanazawaOn("2027-02-06"))).toBe(true);
    expect(isWrittenRequest(kanazawaOn("2027-02-07"))).toBe(false);
    expect(() => firstStartOf(kanazawaOn("2027-02-06"))).toThrow(/Kanazawa/);
  });

  it("plays from its file on its own date, or on a date it is shown on, give or take", () => {
    expect(writtenDayFor(KANAZAWA_START_REQUEST, now)?.request).toBe(KANAZAWA_START_REQUEST);
    expect(writtenDayFor(kanazawaOn("2026-11-14"), now)?.request).toBe(KANAZAWA_START_REQUEST);
  });

  it("is a day of its own on a date further out, which the file does not answer", () => {
    // More than a week from Wednesday the 11th.
    expect(writtenDayFor(kanazawaOn("2026-11-21"), now)).toBeNull();
    expect(writtenDayFor(kanazawaOn("2026-12-05"), now)).toBeNull();
  });

  it("draws its page on the date it is shown on, each stop and its light on that date", () => {
    const shown = shownWrittenDayAt("kanazawa", now);
    const asWritten = writtenDayAt("kanazawa");
    expect(shown?.request).toEqual(kanazawaOn("2026-11-14"));
    expect(shown?.itinerary.date).toBe("2026-11-14");
    expect({ ...shown?.itinerary, date: asWritten?.itinerary.date }).toEqual(asWritten?.itinerary);
    expect(shownWrittenDayAt("kyoto", now)).toBeNull();
  });

  it("reads a re-plan's basis on the date its page shows, and on its own date otherwise", () => {
    expect(writtenDayOn("kanazawa", "2026-11-14", now)?.itinerary.date).toBe("2026-11-14");
    expect(writtenDayOn("kanazawa", "2026-12-05", now)?.itinerary.date).toBe(
      KANAZAWA_START_REQUEST.date,
    );
    expect(writtenDayOn("kyoto", "2026-11-14", now)).toBeNull();
  });
});
