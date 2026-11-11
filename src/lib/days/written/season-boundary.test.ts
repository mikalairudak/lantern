import { describe, expect, it, vi } from "vitest";
import type { WrittenSeason } from "./seasons";
import { KANAZAWA_START_REQUEST } from "./quick-starts";

// Kanazawa given a second season from Saturday 21 November, its day the first's with its own
// line, so the two read apart.
const WINTER_FROM = "2026-11-21";
const WINTER_DEK = "A calm winter Saturday in Kanazawa.";

vi.mock("./start-days", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./start-days")>();
  const { KANAZAWA_START_DAY: autumn } = await import("./kanazawa");
  const winter: WrittenSeason = {
    from: "2026-11-21",
    through: null,
    written: {
      request: { ...autumn.request, date: "2026-11-21" },
      day: { ...autumn.day, dek: "A calm winter Saturday in Kanazawa." },
    },
    checks: {},
  };
  const START_SEASONS = actual.START_SEASONS.map((seasons) =>
    seasons[0]?.written.request.city === "Kanazawa"
      ? [{ ...seasons[0], through: "2026-11-20" }, winter]
      : seasons,
  );
  return { ...actual, START_SEASONS };
});

const {
  shownSeasonAt,
  shownWrittenDayAt,
  writtenDayFor,
  writtenDayOn,
  writtenSeasonFor,
  writtenSeasonsAt,
} = await import("./days");
const { writtenVersionFor } = await import("./version");

const [AUTUMN, WINTER] = writtenSeasonsAt("kanazawa")!;
// Wednesday noon in Tokyo: the page shows Saturday the 14th, the autumn season's.
const BEFORE = new Date("2026-11-11T03:00:00Z");
// Saturday the 14th at nine in Tokyo, the day under way: the page shows the 21st, winter's.
const AFTER = new Date("2026-11-14T00:00:00Z");
const kanazawaOn = (date: string) => ({ ...KANAZAWA_START_REQUEST, date });

describe("a city's day across a season's end", () => {
  it("is drawn from the season its page's date picks, with that season's version and checks", () => {
    const before = shownWrittenDayAt("kanazawa", BEFORE)!;
    expect(before.itinerary.date).toBe("2026-11-14");
    expect(before.itinerary.dek).toBe(AUTUMN!.written.day.dek);
    expect(before.version).toBe(writtenVersionFor(AUTUMN!.written));
    expect(before.checks).toBe(AUTUMN!.checks);

    const after = shownWrittenDayAt("kanazawa", AFTER)!;
    expect(after.itinerary.date).toBe(WINTER_FROM);
    expect(after.itinerary.dek).toBe(WINTER_DEK);
    expect(after.version).toBe(writtenVersionFor(WINTER!.written));
    expect(after.version).not.toBe(before.version);
    expect(after.checks).toBe(WINTER!.checks);
  });

  it("is offered by the start screen in the season its page shows", () => {
    expect(shownSeasonAt("kanazawa", BEFORE)).toBe(AUTUMN);
    expect(shownSeasonAt("kanazawa", AFTER)).toBe(WINTER);
  });

  it("plays from the route as the page that asked showed it, a page drawn before the end too", () => {
    expect(writtenSeasonFor(kanazawaOn("2026-11-14"), BEFORE)).toBe(AUTUMN);
    expect(writtenSeasonFor(kanazawaOn("2026-11-14"), AFTER)).toBe(AUTUMN);
    expect(writtenSeasonFor(kanazawaOn(WINTER_FROM), AFTER)).toBe(WINTER);
    expect(writtenDayFor(kanazawaOn(WINTER_FROM), AFTER)).toBe(WINTER!.written);
  });

  it("plays each season's own request word for word, however far its date", () => {
    const longBefore = new Date("2026-09-01T00:00:00Z");
    expect(writtenSeasonFor(KANAZAWA_START_REQUEST, longBefore)).toBe(AUTUMN);
    expect(writtenSeasonFor(WINTER!.written.request, longBefore)).toBe(WINTER);
  });

  it("reads a re-plan's basis from the season the page's date picks, on that date", () => {
    const shownBefore = writtenDayOn("kanazawa", "2026-11-14", AFTER)!;
    expect(shownBefore.itinerary.dek).toBe(AUTUMN!.written.day.dek);
    expect(shownBefore.itinerary.date).toBe("2026-11-14");

    const shownAfter = writtenDayOn("kanazawa", WINTER_FROM, AFTER)!;
    expect(shownAfter.itinerary.dek).toBe(WINTER_DEK);
    expect(shownAfter.itinerary.date).toBe(WINTER_FROM);
  });

  it("reads a basis further out from its season, on the season's own date", () => {
    const farOut = writtenDayOn("kanazawa", "2027-01-09", AFTER)!;
    expect(farOut.itinerary.dek).toBe(WINTER_DEK);
    expect(farOut.itinerary.date).toBe(WINTER_FROM);
  });
});
