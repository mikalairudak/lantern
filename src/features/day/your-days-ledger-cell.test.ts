import { describe, expect, it } from "vitest";
import { playedDayOf } from "./your-days-ledger-cell";
import type { YourDay } from "./your-days";

/** Sunday 15 November 2026, six in the evening in Alicante. */
const NOW = new Date("2026-11-15T17:00:00Z");

function dayOf(change: Partial<YourDay> = {}, date = "2026-11-21"): YourDay {
  return {
    id: "a",
    request: {
      city: "Alicante",
      date,
      timezone: "Europe/Madrid",
      citySource: "chosen",
      energy: "social",
      energySource: "chosen",
      travel: null,
      start: null,
      dinner: null,
      end: null,
      company: null,
    },
    startedAt: "2026-10-01T10:00:00.000Z",
    energies: [],
    ending: "written",
    seconds: null,
    ...change,
  };
}

describe("playedDayOf", () => {
  it("asks the day now, and writes it until the press", () => {
    const played = playedDayOf(dayOf(), NOW, false);

    expect(played.ending).toBe("writing");
    expect(played.startedAt).toBe(NOW.toISOString());
    expect(played.request.date).toBe("2026-11-21");
  });

  it("plans a day whose date has passed for today, as a request for a past day is", () => {
    expect(playedDayOf(dayOf({}, "2026-10-14"), NOW, true).request.date).toBe("2026-11-15");
  });

  it("ends a day being written as written, and any other as it ended", () => {
    expect(playedDayOf(dayOf({ ending: "writing" }), NOW, true).ending).toBe("written");
    expect(playedDayOf(dayOf({ ending: "cut" }), NOW, true).ending).toBe("cut");
    expect(playedDayOf(dayOf({ ending: "failed" }), NOW, true).ending).toBe("failed");
  });
});
