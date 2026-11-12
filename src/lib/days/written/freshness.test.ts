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

  it("holds while every stop begins in the light it was written for, and not once one does not", () => {
    // The garden at half past seven is in golden hour from mid-December.
    expect(dayOnDate(KANAZAWA_AUTUMN!.written, "2026-12-05")).toMatchObject({
      stopsInOtherLight: 0,
      holds: true,
    });
    expect(dayOnDate(KANAZAWA_AUTUMN!.written, "2026-12-12")).toMatchObject({
      lightSense: 1,
      stopsInOtherLight: 1,
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
    expect(freshUntil(KANAZAWA, "2026-11-14")).toBe("2026-12-05");
    expect(freshUntil(PORTO, "2026-11-22")).toBe("2027-01-10");
  });

  it("is null when the day fails on the date it starts from", () => {
    expect(freshUntil(PORTO, "2026-11-15")).toBeNull();
  });

  it("follows each date into the season it picks, so a later season carries the day on", () => {
    const winter = kanazawaWrittenFor("2026-12-12");
    const autumn = { ...KANAZAWA_AUTUMN!, through: "2026-12-11" };
    expect(freshUntil([autumn, winter], "2026-11-14")).toBe("2027-01-30");
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
      "bologna: shown 2026-11-14, season 2026-11-07 to open, holds until 2027-01-23, 73 days left",
      "porto: shown 2026-11-15, season 2026-11-15 to open, does not hold on 2026-11-15  FLAG",
      "kanazawa: shown 2026-11-14, season 2026-11-07 to open, holds until 2026-12-05, 24 days left",
      "madrid: shown 2026-11-15, season 2026-11-15 to open, holds until 2027-02-07, 88 days left",
      "utrecht: shown 2026-11-15, season 2026-11-08 to open, holds until 2027-01-31, 81 days left",
      "nafplio: shown 2026-11-14, season 2026-11-07 to open, holds until 2027-02-06, 87 days left",
      "paris: shown 2026-11-15, season 2026-11-15 to open, holds until 2027-01-17, 67 days left",
      "tokyo: shown 2026-11-14, season 2026-11-14 to open, holds until 2027-01-02, 52 days left",
      "rome: shown 2026-11-14, season 2026-11-14 to open, holds until 2027-01-30, 80 days left",
      "new-york: shown 2026-11-14, season 2026-11-14 to open, holds until 2027-01-16, 66 days left",
      "amsterdam: shown 2026-11-15, season 2026-11-15 to open, holds until 2027-01-17, 67 days left",
      "barcelona: shown 2026-11-14, season 2026-11-14 to open, holds until 2027-02-13, 94 days left",
      "seoul: shown 2026-11-13, season 2026-11-13 to open, holds until 2027-01-22, 72 days left",
      "Under 21 days: Porto. Each needs its next season written.",
    ]);
  });

  it("counts days left from today in the city, and flags a day under three weeks from its end", () => {
    // Monday the 16th: Porto's page has moved on to the 22nd, and Kanazawa's day ends in 19.
    const cities = freshnessAt(new Date("2026-11-16T12:00:00Z"));
    expect(cities.find(({ city }) => city === "Porto")).toMatchObject({
      shownOn: "2026-11-22",
      freshUntil: "2027-01-10",
      daysLeft: 55,
      isFlagged: false,
    });
    expect(cities.find(({ city }) => city === "Kanazawa")).toMatchObject({
      freshUntil: "2026-12-05",
      daysLeft: 19,
      isFlagged: true,
    });
  });

  it("says so when every city holds for three weeks or more", () => {
    const holding: CityFreshness = {
      city: "Utrecht",
      shownOn: "2026-11-22",
      season: { from: "2026-11-08", through: null },
      isInSeason: true,
      freshUntil: "2027-01-31",
      daysLeft: 76,
      isFlagged: false,
    };
    expect(freshnessReportOf([holding])).toEqual([
      "utrecht: shown 2026-11-22, season 2026-11-08 to open, holds until 2027-01-31, 76 days left",
      `Every written day holds for ${DAYS_LEFT_TO_FLAG} days or more.`,
    ]);
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
