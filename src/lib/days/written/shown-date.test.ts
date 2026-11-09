import { describe, expect, it } from "vitest";
import { cityClockOf, isOnItsWeekday, isShownNear, shownDateOf } from "./shown-date";
import { KANAZAWA_START_REQUEST, PORTO_START_REQUEST, UTRECHT_START_REQUEST } from "./quick-starts";

// Kanazawa's day is a Saturday's in Tokyo, its first stop at half past seven; Porto's a
// Sunday's in Lisbon, at ten; Utrecht's a Sunday's in Amsterdam, at ten.
const KANAZAWA_FIRST = "07:30";
const PORTO_FIRST = "10:00";
const UTRECHT_FIRST = "10:00";

const at = (instant: string) => new Date(instant);

describe("cityClockOf", () => {
  it("reads the date and the minute in the city, whatever the server's zone", () => {
    const now = at("2026-11-13T15:30:00Z");
    expect(cityClockOf("Asia/Tokyo", now)).toEqual({ date: "2026-11-14", minutes: 30 });
    expect(cityClockOf("Europe/Lisbon", now)).toEqual({ date: "2026-11-13", minutes: 930 });
    expect(cityClockOf("America/Los_Angeles", now)).toEqual({ date: "2026-11-13", minutes: 450 });
  });

  it("reads midnight as the day's first minute", () => {
    expect(cityClockOf("Europe/Lisbon", at("2026-11-14T00:00:00Z"))).toEqual({
      date: "2026-11-14",
      minutes: 0,
    });
  });
});

describe("shownDateOf", () => {
  const kanazawa = (instant: string) =>
    shownDateOf(KANAZAWA_START_REQUEST, KANAZAWA_FIRST, at(instant));

  it("shows a day on its weekday's next date in its city", () => {
    // Wednesday 11 November in Tokyo.
    expect(kanazawa("2026-11-11T03:00:00Z")).toBe("2026-11-14");
  });

  it("turns the date at the city's midnight, not the server's", () => {
    // 23:59 on Friday in Tokyo, while UTC is still Friday afternoon: tomorrow.
    expect(kanazawa("2026-11-13T14:59:00Z")).toBe("2026-11-14");
    // A minute on, Saturday in Tokyo: today, the first stop still ahead.
    expect(kanazawa("2026-11-13T15:00:00Z")).toBe("2026-11-14");
  });

  it("shows today on its own weekday until the first stop begins, then a week on", () => {
    // 07:29 on Saturday in Tokyo, while UTC is still Friday.
    expect(kanazawa("2026-11-13T22:29:00Z")).toBe("2026-11-14");
    // 07:30: the day is under way, so the next Saturday.
    expect(kanazawa("2026-11-13T22:30:00Z")).toBe("2026-11-21");
    // 23:00 on Saturday in Tokyo.
    expect(kanazawa("2026-11-14T14:00:00Z")).toBe("2026-11-21");
  });

  it("reads the first stop's hour in the day's own zone", () => {
    const porto = (instant: string) => shownDateOf(PORTO_START_REQUEST, PORTO_FIRST, at(instant));
    // Sunday 15 November, Lisbon at UTC in winter: 09:59, then 10:00.
    expect(porto("2026-11-15T09:59:00Z")).toBe("2026-11-15");
    expect(porto("2026-11-15T10:00:00Z")).toBe("2026-11-22");
  });

  it("crosses into the next month", () => {
    // Sunday 29 November in Tokyo: the next Saturday is in December.
    expect(kanazawa("2026-11-29T03:00:00Z")).toBe("2026-12-05");
  });

  it("crosses into the next year, from a weekday and from a day under way", () => {
    // Wednesday 30 December in Tokyo.
    expect(kanazawa("2026-12-30T03:00:00Z")).toBe("2027-01-02");
    // Saturday 26 December in Tokyo, at noon: the day under way.
    expect(kanazawa("2026-12-26T03:00:00Z")).toBe("2027-01-02");
  });

  it("reads the hour on the clocks' own Sunday, the day they go forward", () => {
    const utrecht = (instant: string) =>
      shownDateOf(UTRECHT_START_REQUEST, UTRECHT_FIRST, at(instant));
    // Sunday 28 March 2027 in Amsterdam, on summer time from 01:00 UTC: 07:30 UTC is 09:30
    // there, the first stop ahead; 08:30 UTC is 10:30, the day under way.
    expect(utrecht("2027-03-28T07:30:00Z")).toBe("2027-03-28");
    expect(utrecht("2027-03-28T08:30:00Z")).toBe("2027-04-04");
  });

  it("says so of a first stop with no time it can read", () => {
    expect(() => shownDateOf(KANAZAWA_START_REQUEST, "soon", at("2026-11-11T03:00:00Z"))).toThrow(
      /no time/,
    );
  });
});

describe("isOnItsWeekday", () => {
  it("takes a written day's words on any date of its weekday", () => {
    expect(isOnItsWeekday(KANAZAWA_START_REQUEST, { ...KANAZAWA_START_REQUEST })).toBe(true);
    expect(
      isOnItsWeekday(KANAZAWA_START_REQUEST, { ...KANAZAWA_START_REQUEST, date: "2027-03-06" }),
    ).toBe(true);
  });

  it("takes no other weekday, and no other word", () => {
    expect(
      isOnItsWeekday(KANAZAWA_START_REQUEST, { ...KANAZAWA_START_REQUEST, date: "2026-11-15" }),
    ).toBe(false);
    expect(
      isOnItsWeekday(KANAZAWA_START_REQUEST, { ...KANAZAWA_START_REQUEST, energy: "lively" }),
    ).toBe(false);
  });
});

describe("isShownNear", () => {
  // Sunday 15 November in Tokyo, the day after a Saturday.
  const now = at("2026-11-15T03:00:00Z");
  const on = (date: string) => ({ ...KANAZAWA_START_REQUEST, date });

  it("takes the dates a page shows, from yesterday to a week from today in the city", () => {
    expect(isShownNear(KANAZAWA_START_REQUEST, on("2026-11-14"), now)).toBe(true);
    expect(isShownNear(KANAZAWA_START_REQUEST, on("2026-11-21"), now)).toBe(true);
  });

  it("takes no date further out, nor one before yesterday", () => {
    expect(isShownNear(KANAZAWA_START_REQUEST, on("2026-11-28"), now)).toBe(false);
    expect(isShownNear(KANAZAWA_START_REQUEST, on("2026-11-07"), now)).toBe(false);
  });

  it("takes no other weekday, and no other word, inside the week", () => {
    expect(isShownNear(KANAZAWA_START_REQUEST, on("2026-11-20"), now)).toBe(false);
    expect(
      isShownNear(KANAZAWA_START_REQUEST, { ...on("2026-11-21"), company: "family" }, now),
    ).toBe(false);
  });

  it("takes a week from today on the weekday itself, the date a page shows once the day began", () => {
    // Saturday 14 November in Tokyo at noon: the page shows the 21st.
    const saturday = at("2026-11-14T03:00:00Z");
    expect(isShownNear(KANAZAWA_START_REQUEST, on("2026-11-14"), saturday)).toBe(true);
    expect(isShownNear(KANAZAWA_START_REQUEST, on("2026-11-21"), saturday)).toBe(true);
  });
});
