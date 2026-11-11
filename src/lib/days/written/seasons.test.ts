import { describe, expect, it } from "vitest";
import { KANAZAWA_START_DAY } from "./kanazawa";
import { firstSeasonOf, isInSeason, seasonOn, type WrittenSeason } from "./seasons";

function seasonOf(from: string, through: string | null): WrittenSeason {
  return { from, through, written: KANAZAWA_START_DAY, checks: {} };
}

// Autumn to the year's end, then from a gap's far side on, open.
const AUTUMN = seasonOf("2026-11-07", "2026-12-31");
const SPRING = seasonOf("2027-03-01", null);
const SEASONS = [AUTUMN, SPRING];

describe("the season a date picks", () => {
  it("is the one whose range holds it, from its first date to its last", () => {
    expect(seasonOn(SEASONS, "2026-11-07")).toBe(AUTUMN);
    expect(seasonOn(SEASONS, "2026-12-31")).toBe(AUTUMN);
    expect(seasonOn(SEASONS, "2027-03-01")).toBe(SPRING);
    expect(seasonOn(SEASONS, "2028-06-01")).toBe(SPRING);
  });

  it("is the one that began last when none holds it, so a city whose days run out keeps its latest", () => {
    expect(seasonOn(SEASONS, "2027-01-01")).toBe(AUTUMN);
    expect(seasonOn(SEASONS, "2027-02-28")).toBe(AUTUMN);
    expect(seasonOn([AUTUMN], "2027-06-05")).toBe(AUTUMN);
  });

  it("is the first for a date before them all", () => {
    expect(seasonOn(SEASONS, "2026-10-31")).toBe(AUTUMN);
  });

  it("says whether the season answers by its range or for want of a later one", () => {
    expect(isInSeason(AUTUMN, "2026-12-31")).toBe(true);
    expect(isInSeason(AUTUMN, "2027-01-01")).toBe(false);
    expect(isInSeason(AUTUMN, "2026-11-06")).toBe(false);
    expect(isInSeason(SPRING, "2030-01-01")).toBe(true);
  });

  it("is asked of a city that has one, and says so when it has none", () => {
    expect(firstSeasonOf(SEASONS)).toBe(AUTUMN);
    expect(() => seasonOn([], "2026-11-07")).toThrow("A written city has no season");
  });
});
