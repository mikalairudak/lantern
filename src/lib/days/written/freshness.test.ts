import { describe, expect, it } from "vitest";
import { writtenSeasonsAt } from "./days";
import {
  type CityFreshness,
  DAYS_LEFT_TO_FLAG,
  dayOnDate,
  freshUntil,
  freshnessAt,
  freshnessReportOf,
} from "./freshness";
import type { WrittenSeason } from "./seasons";
import { dateAfter } from "./shown-date";

const KANAZAWA = writtenSeasonsAt("kanazawa")!;
const PORTO = writtenSeasonsAt("porto")!;
const [KANAZAWA_AUTUMN] = KANAZAWA;

/** Kanazawa's day written again for a later date, as its next season would be. */
function kanazawaWrittenFor(date: string): WrittenSeason {
  const { written } = KANAZAWA_AUTUMN!;
  return {
    ...KANAZAWA_AUTUMN!,
    from: date,
    written: { ...written, request: { ...written.request, date } },
  };
}

describe("a written day moved to another date", () => {
  it("is in the light it was written for on its own date", () => {
    expect(dayOnDate(KANAZAWA_AUTUMN!.written, "2026-11-07")).toEqual({
      lightSense: 1,
      stopsInOtherLight: 0,
      holds: true,
    });
  });

  it("holds with one stop in another light, and not with two", () => {
    // The garden at half past seven is in golden hour by December; by late June so is a
    // second stop.
    expect(dayOnDate(KANAZAWA_AUTUMN!.written, "2026-12-12")).toMatchObject({
      stopsInOtherLight: 1,
      holds: true,
    });
    expect(dayOnDate(KANAZAWA_AUTUMN!.written, "2027-06-26")).toMatchObject({
      stopsInOtherLight: 2,
      holds: false,
    });
  });

  it("does not hold when its stops miss their light windows", () => {
    // Porto's day misses two of its five light windows on its own Sunday.
    expect(dayOnDate(PORTO[0]!.written, "2026-11-15")).toMatchObject({
      lightSense: 0.6,
      holds: false,
    });
  });
});

describe("freshUntil", () => {
  it("is the last date a week at a time before the first on which the day fails", () => {
    expect(freshUntil(KANAZAWA, "2026-11-14")).toBe("2027-06-19");
    expect(freshUntil(PORTO, "2026-11-22")).toBe("2027-03-14");
  });

  it("is null when the day fails on the date it starts from", () => {
    expect(freshUntil(PORTO, "2026-11-15")).toBeNull();
  });

  it("follows each date into the season it picks, so a later season carries the day on", () => {
    const summer = kanazawaWrittenFor("2027-06-26");
    const autumn = { ...KANAZAWA_AUTUMN!, through: "2027-06-25" };
    expect(freshUntil([autumn, summer], "2026-11-14")).toBe("2027-09-11");
  });

  it("is the last date of a year followed when the day never fails", () => {
    // A season written for every week: each date's day is in the light it was written for.
    const weekly = Array.from({ length: 53 }, (_, week) =>
      kanazawaWrittenFor(dateAfter("2026-11-14", week * 7)),
    );
    expect(freshUntil(weekly, "2026-11-14")).toBe(dateAfter("2026-11-14", 52 * 7));
  });
});

describe("the freshness report", () => {
  it("says each city's shown date, season and days left, and flags one that fails now", () => {
    // Wednesday 11 November: Porto's page shows Sunday the 15th, which its day fails.
    expect(freshnessReportOf(freshnessAt(new Date("2026-11-11T12:00:00Z")))).toEqual([
      "bologna: shown 2026-11-14, season 2026-11-07 to open, holds until 2027-06-12, 213 days left",
      "porto: shown 2026-11-15, season 2026-11-15 to open, does not hold on 2026-11-15  FLAG",
      "kanazawa: shown 2026-11-14, season 2026-11-07 to open, holds until 2027-06-19, 220 days left",
      "madrid: shown 2026-11-14, season 2026-11-14 to open, holds until 2027-05-15, 185 days left",
      "utrecht: shown 2026-11-15, season 2026-11-08 to open, holds until 2027-03-21, 130 days left",
      "nafplio: shown 2026-11-14, season 2026-11-07 to open, holds until 2027-03-27, 136 days left",
      "Under 21 days: Porto. Each needs its next season written.",
    ]);
  });

  it("says so when every city holds for three weeks or more", () => {
    // Monday the 16th: Porto's page has moved on to the 22nd.
    const cities = freshnessAt(new Date("2026-11-16T12:00:00Z"));
    expect(cities.find(({ city }) => city === "Porto")).toMatchObject({
      shownOn: "2026-11-22",
      freshUntil: "2027-03-14",
      daysLeft: 118,
      isFlagged: false,
    });
    expect(freshnessReportOf(cities).at(-1)).toBe(
      `Every written day holds for ${DAYS_LEFT_TO_FLAG} days or more.`,
    );
  });

  it("flags a day close to its end, and one served past its season's", () => {
    const pastItsEnd: CityFreshness = {
      city: "Kanazawa",
      shownOn: "2027-01-09",
      season: { from: "2026-11-07", through: "2026-12-31" },
      isInSeason: false,
      freshUntil: "2027-01-23",
      daysLeft: 16,
      isFlagged: true,
    };
    expect(freshnessReportOf([pastItsEnd])).toEqual([
      "kanazawa: shown 2027-01-09, season 2026-11-07 to 2026-12-31, served past its end, holds until 2027-01-23, 16 days left  FLAG",
      "Under 21 days: Kanazawa. Each needs its next season written.",
    ]);
  });
});
