import { describe, expect, it } from "vitest";
import { utcDayOf, utcMonthOf } from "./utc-day";

describe("utcDayOf", () => {
  it("reads the calendar day in UTC", () => {
    expect(utcDayOf(new Date("2026-11-19T23:30:00-05:00"))).toBe("2026-11-20");
  });
});

describe("utcMonthOf", () => {
  it("reads the calendar month in UTC", () => {
    expect(utcMonthOf(new Date("2026-11-30T23:30:00-05:00"))).toBe("2026-12");
  });
});
