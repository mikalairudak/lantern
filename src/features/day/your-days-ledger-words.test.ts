import { describe, expect, it } from "vitest";
import { KEPT_WAIT_MS } from "./kept-day";
import type { YourDay } from "./your-days";
import {
  calendarWordOf,
  hasNoDayBehind,
  isLinkExpired,
  ledgerDateOf,
  ledgerEndingOf,
  ledgerWordsOf,
} from "./your-days-ledger-words";

/** Sunday 15 November 2026, six in the evening in Alicante. */
const NOW = new Date("2026-11-15T17:00:00Z");
const DAY_MS = 86_400_000;

function dayOf(change: Partial<YourDay> = {}, request: Partial<YourDay["request"]> = {}): YourDay {
  return {
    id: "a",
    request: {
      city: "Alicante",
      date: "2026-11-15",
      timezone: "Europe/Madrid",
      citySource: "chosen",
      energy: "social",
      energySource: "chosen",
      travel: "transit",
      start: null,
      dinner: null,
      end: null,
      company: "friends",
      ...request,
    },
    startedAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
    energies: [],
    ending: "written",
    seconds: null,
    ...change,
  };
}

describe("calendarWordOf", () => {
  it("names the days beside today in words, and the rest by their date", () => {
    expect(calendarWordOf("2026-11-15", "2026-11-15")).toBe("today");
    expect(calendarWordOf("2026-11-16", "2026-11-15")).toBe("tomorrow");
    expect(calendarWordOf("2026-11-14", "2026-11-15")).toBe("yesterday");
    expect(calendarWordOf("2026-11-21", "2026-11-15")).toBe("21 Nov");
  });

  it("says the year only of a date in another year", () => {
    expect(calendarWordOf("2027-01-03", "2026-11-15")).toBe("3 Jan 2027");
    expect(calendarWordOf("2025-12-31", "2026-01-02")).toBe("31 Dec 2025");
    expect(calendarWordOf("2026-12-31", "2027-01-01")).toBe("yesterday");
  });
});

describe("ledgerDateOf", () => {
  it("says writing while the day is written, whatever its date", () => {
    expect(ledgerDateOf(dayOf({ ending: "writing" }, { date: "2026-11-21" }), NOW)).toBe("writing");
  });

  it("says the day's own date, read beside today in the day's own city", () => {
    expect(ledgerDateOf(dayOf({}, { date: "2026-11-21" }), NOW)).toBe("21 Nov");
    // Six in the morning of the 16th in Auckland while it is the 15th in Alicante.
    const auckland = dayOf({}, { date: "2026-11-16", timezone: "Pacific/Auckland" });
    expect(ledgerDateOf(auckland, NOW)).toBe("today");
    expect(ledgerDateOf(dayOf({}, { date: "2026-11-16" }), NOW)).toBe("tomorrow");
  });

  it("says when the day was asked for, in the visitor's calendar, when asked to", () => {
    const now = new Date(2026, 10, 15, 18, 0);
    const askedYesterday = dayOf({ startedAt: new Date(2026, 10, 14, 23, 50).toISOString() });
    expect(ledgerDateOf(askedYesterday, now, "asked")).toBe("yesterday");
    const askedLastWeek = dayOf(
      { startedAt: new Date(2026, 10, 8, 9, 0).toISOString() },
      { date: "2026-11-21" },
    );
    expect(ledgerDateOf(askedLastWeek, now, "asked")).toBe("8 Nov");
  });
});

describe("how a day ended", () => {
  const LINK_MS = 30 * DAY_MS + KEPT_WAIT_MS;
  const askedAgo = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

  it("counts a link's days from when the day was asked plus the longest wait for it", () => {
    expect(isLinkExpired(dayOf({ startedAt: askedAgo(LINK_MS) }), NOW)).toBe(false);
    expect(isLinkExpired(dayOf({ startedAt: askedAgo(LINK_MS + 1) }), NOW)).toBe(true);
  });

  it("says no day first, then a link past its days, then a day cut short", () => {
    const old = askedAgo(LINK_MS + 1);
    expect(ledgerEndingOf(dayOf({ ending: "failed", startedAt: old }), NOW)).toBe("not finished");
    expect(ledgerEndingOf(dayOf({ ending: "cut", startedAt: old }), NOW)).toBe("link expired");
    expect(ledgerEndingOf(dayOf({ ending: "written", startedAt: old }), NOW)).toBe("link expired");
    expect(ledgerEndingOf(dayOf({ ending: "cut" }), NOW)).toBe("cut short");
  });

  it("says nothing of a day being written or written and open", () => {
    expect(
      ledgerEndingOf(dayOf({ ending: "writing", startedAt: askedAgo(LINK_MS + 1) }), NOW),
    ).toBe(null);
    expect(ledgerEndingOf(dayOf(), NOW)).toBe(null);
  });

  it("has no day behind a row that did not finish or whose link has passed", () => {
    expect(hasNoDayBehind(dayOf({ ending: "failed" }), NOW)).toBe(true);
    expect(hasNoDayBehind(dayOf({ startedAt: askedAgo(LINK_MS + 1) }), NOW)).toBe(true);
    expect(hasNoDayBehind(dayOf({ ending: "cut" }), NOW)).toBe(false);
    expect(hasNoDayBehind(dayOf(), NOW)).toBe(false);
  });
});

describe("ledgerWordsOf", () => {
  it("says the day without its city: the energy's word with a capital, the weekday, the words", () => {
    expect(ledgerWordsOf(dayOf())).toEqual({
      energy: "Social",
      words: ["Sunday", "by public transport", "with friends"],
    });
    expect(ledgerWordsOf(dayOf({}, { energy: "reflective", travel: null, company: null }))).toEqual(
      { energy: "Quiet", words: ["Sunday"] },
    );
  });
});
