import { describe, expect, it } from "vitest";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import { daySummaryOf, type DaySummary } from "./day-end";
import { clockWordsOf, dayEndWordsOf, routeLabelOf, summaryLineOf } from "./day-end-words";

const TIED = " ";

/** What each stop shows as written: the model's pick. */
const WRITTEN = KYOTO_ITINERARY.stops.map((stop) =>
  [stop.primary, ...stop.alternatives].findIndex((place) => place.id === stop.selectedPlaceId),
);

describe("clockWordsOf", () => {
  it.each([
    ["19:30", "half past seven"],
    ["19:45", "quarter to eight"],
    ["19:15", "quarter past seven"],
    ["23:00", "eleven"],
    ["21:05", "five past nine"],
    ["21:20", "twenty past nine"],
    ["21:25", "twenty-five past nine"],
    ["21:35", "twenty-five to ten"],
    ["21:40", "twenty to ten"],
    ["21:50", "ten to ten"],
    ["21:55", "five to ten"],
    ["12:00", "noon"],
    ["12:30", "half past twelve"],
    ["11:45", "quarter to twelve"],
    ["23:45", "quarter to midnight"],
  ])("says %s as %s", (clock, words) => {
    expect(clockWordsOf(clock)).toBe(words);
  });

  it("goes on to the next five minutes, so the day is never over later than it says", () => {
    expect(clockWordsOf("19:37")).toBe("twenty to eight");
    expect(clockWordsOf("19:31")).toBe("twenty-five to eight");
    expect(clockWordsOf("19:58")).toBe("eight");
    expect(clockWordsOf("23:56")).toBe("midnight");
  });

  it("says a time on the next day's clock is in the morning, but midnight is midnight", () => {
    expect(clockWordsOf("01:30", true)).toBe("half past one in the morning");
    expect(clockWordsOf("00:00", true)).toBe("midnight");
    expect(clockWordsOf("00:15", true)).toBe("quarter past midnight");
    expect(clockWordsOf("00:50", true)).toBe("ten to one in the morning");
  });
});

describe("summaryLineOf", () => {
  const summary: DaySummary = {
    endsAt: "19:30",
    isPastMidnight: false,
    stops: 8,
    meters: 6210,
    distanceLine: "about 6.2 km on foot",
  };

  it("says when the day ends, its stops and how far, each whole on a line", () => {
    expect(summaryLineOf(summary)).toBe(
      `Home by half past seven ·${TIED}8${TIED}stops ·${TIED}about${TIED}6.2${TIED}km${TIED}on${TIED}foot`,
    );
  });

  it("says one stop, and no distance, for a day of one stop", () => {
    expect(summaryLineOf({ ...summary, stops: 1, distanceLine: null })).toBe(
      `Home by half past seven ·${TIED}1${TIED}stop`,
    );
  });

  it("ties metres too", () => {
    expect(summaryLineOf({ ...summary, distanceLine: "about 800 m" })).toContain(
      `about${TIED}800${TIED}m`,
    );
  });
});

describe("routeLabelOf", () => {
  it("walks the whole day, or says how far the map takes it", () => {
    expect(routeLabelOf({ url: "", included: 8, total: 8 })).toBe("Walk it in Google Maps");
    expect(routeLabelOf({ url: "", included: 11, total: 12 })).toBe(
      `Walk the first 11${TIED}stops in Google Maps`,
    );
  });
});

describe("dayEndWordsOf", () => {
  it("reads the normalized day, by the versions shown", () => {
    const words = dayEndWordsOf(KYOTO_ITINERARY, WRITTEN, {});
    const summary = daySummaryOf(KYOTO_ITINERARY.stops, WRITTEN, "on-foot");
    expect(words.endsAt).toBe(summary.endsAt);
    expect(words.summary.startsWith("Home by ")).toBe(true);
    expect(words.summary).toContain(`${KYOTO_ITINERARY.stops.length}${TIED}stops`);
    expect(words.route?.total).toBe(KYOTO_ITINERARY.stops.length);
  });

  it("says nothing found for a day with no checks, and counts them where there are", () => {
    expect(dayEndWordsOf(KYOTO_ITINERARY, WRITTEN, {}).found).toBeNull();
    const checks: PlaceChecks = Object.fromEntries(
      KYOTO_ITINERARY.stops.map((stop) => [
        stop.selectedPlaceId,
        { placeId: stop.selectedPlaceId, state: "confirmed", by: "area" } as const,
      ]),
    );
    const total = KYOTO_ITINERARY.stops.length;
    expect(dayEndWordsOf(KYOTO_ITINERARY, WRITTEN, checks).found).toBe(
      `${total} of ${total} places found on OpenStreetMap`,
    );
  });

  it("says the day's travel as its facts have it, assumed or the visitor's", () => {
    const transit = {
      ...KYOTO_ITINERARY,
      facts: { ...KYOTO_ITINERARY.facts, travel: { value: "transit", source: "assumed" } },
    } as const;
    expect(dayEndWordsOf(transit, WRITTEN, {}).summary).not.toContain("on foot");
  });
});
