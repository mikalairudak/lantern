import { describe, expect, it } from "vitest";
import { LIGHT_WINDOWS, type LightWindow } from "@/lib/schema/itinerary.schema";
import {
  isVisitedInWindow,
  lightWindowSpan,
  MIN_MINUTES_IN_WINDOW,
  overlapMinutes,
  type MinuteSpan,
} from "./light-windows";
import { utcOffsetMinutes, type DayContext } from "./sun";

const ALICANTE: DayContext = {
  position: { lat: 38.3452, lng: -0.481 },
  date: "2026-11-14",
  utcOffsetMinutes: utcOffsetMinutes("Europe/Madrid", "2026-11-14"),
};

// Mid-December in Tromsø: the sun never rises, though civil twilight still comes at noon.
const POLAR_NIGHT: DayContext = {
  position: { lat: 69.6492, lng: 18.9553 },
  date: "2026-12-15",
  utcOffsetMinutes: utcOffsetMinutes("Europe/Oslo", "2026-12-15"),
};

// Tromsø in June: the sun never sets, but it dips below the golden line around midnight.
const MIDNIGHT_SUN: DayContext = {
  position: { lat: 69.6492, lng: 18.9553 },
  date: "2027-06-19",
  utcOffsetMinutes: utcOffsetMinutes("Europe/Oslo", "2027-06-19"),
};

// Reykjavík in June: the sun sets a few minutes after midnight and it never gets dark.
const WHITE_NIGHT: DayContext = {
  position: { lat: 64.1466, lng: -21.9426 },
  date: "2027-06-21",
  utcOffsetMinutes: utcOffsetMinutes("Atlantic/Reykjavik", "2027-06-21"),
};

// Tromsø in late November: the sun barely clears the horizon, so its light stays golden.
const LOW_SUN: DayContext = {
  position: { lat: 69.6492, lng: 18.9553 },
  date: "2026-11-24",
  utcOffsetMinutes: utcOffsetMinutes("Europe/Oslo", "2026-11-24"),
};

// Longyearbyen at midwinter: the sun stays below the night line all day.
const DEEP_POLAR_NIGHT: DayContext = {
  position: { lat: 78.2232, lng: 15.6267 },
  date: "2026-12-21",
  utcOffsetMinutes: utcOffsetMinutes("Arctic/Longyearbyen", "2026-12-21"),
};

const MIDDAY_HALF_SPAN_MINUTES = 120;
const END_OF_DAY = 24 * 60;
// The sun's lowest point after noon falls within a few hours of midnight in any time zone.
const LATEST_LOW_SUN = END_OF_DAY + 3 * 60;
// A night with no first light at its end lasts through the next day.
const END_OF_NEXT_DAY = 2 * END_OF_DAY;
// The next morning's sun is worked out on this day's count, a minute either way.
const NEXT_DAY_SLACK_MINUTES = 1;

function spanOf(context: DayContext, window: LightWindow): MinuteSpan {
  const span = lightWindowSpan(context, window);
  if (!span) throw new Error(`No ${window} span`);
  return span;
}

describe("lightWindowSpan", () => {
  it("gives every window a span on an ordinary day, each starting before it ends", () => {
    for (const window of LIGHT_WINDOWS) {
      const span = spanOf(ALICANTE, window);
      expect(span.from).toBeLessThan(span.to);
    }
  });

  it("orders the day from first light to night", () => {
    const sunrise = spanOf(ALICANTE, "sunrise");
    const morning = spanOf(ALICANTE, "morning");
    const afternoon = spanOf(ALICANTE, "afternoon");
    const sunset = spanOf(ALICANTE, "sunset");
    const afterDark = spanOf(ALICANTE, "after-dark");
    expect(sunrise.from).toBeLessThan(morning.from);
    expect(morning.from).toBeLessThan(sunrise.to);
    expect(morning.to).toBe(afternoon.from);
    expect(sunset.from).toBeLessThan(afternoon.to);
    expect(afternoon.to).toBeLessThan(sunset.to);
    expect(sunset.to).toBe(afterDark.from);
  });

  it("keeps the night until first light the next morning", () => {
    const nextDay = { ...ALICANTE, date: "2026-11-15" };
    const firstLight = spanOf(nextDay, "sunrise").from + END_OF_DAY;
    const afterDark = spanOf(ALICANTE, "after-dark");
    expect(Math.abs(afterDark.to - firstLight)).toBeLessThanOrEqual(NEXT_DAY_SLACK_MINUTES);
    // A club from one in the morning until four is in the dark the whole time.
    const clubNight = { from: END_OF_DAY + 60, to: END_OF_DAY + 4 * 60 };
    expect(overlapMinutes(clubNight, afterDark)).toBe(3 * 60);
  });

  it("centres midday on the sun's noon, between morning and afternoon", () => {
    const noon = spanOf(ALICANTE, "morning").to;
    expect(spanOf(ALICANTE, "midday")).toEqual({
      from: noon - MIDDAY_HALF_SPAN_MINUTES,
      to: noon + MIDDAY_HALF_SPAN_MINUTES,
    });
  });

  it("keeps a midnight sun's windows inside its own day", () => {
    const sunrise = spanOf(MIDNIGHT_SUN, "sunrise");
    expect(spanOf(MIDNIGHT_SUN, "morning").from).toBe(sunrise.from);
    const sunset = spanOf(MIDNIGHT_SUN, "sunset");
    expect(sunset.to).toBeGreaterThan(END_OF_DAY);
    expect(spanOf(MIDNIGHT_SUN, "afternoon").to).toBe(sunset.to);
    expect(lightWindowSpan(MIDNIGHT_SUN, "after-dark")).toBeNull();
    // A visit from 23:45 to 00:40 is in the low evening sun the whole time.
    const acrossMidnight = { from: END_OF_DAY - 15, to: END_OF_DAY + 40 };
    expect(overlapMinutes(acrossMidnight, sunset)).toBe(55);
  });

  it("gives a sunset after midnight to the day it ends", () => {
    const morning = spanOf(WHITE_NIGHT, "morning");
    expect(morning.from).toBeLessThan(morning.to);
    expect(spanOf(WHITE_NIGHT, "midday").from).toBeGreaterThan(morning.from);
    expect(spanOf(WHITE_NIGHT, "afternoon").to).toBeGreaterThan(END_OF_DAY);
    expect(lightWindowSpan(WHITE_NIGHT, "after-dark")).toBeNull();
  });

  it("keeps a low sun golden from dawn to dusk", () => {
    const noon = spanOf(LOW_SUN, "morning").to;
    expect(spanOf(LOW_SUN, "sunrise").to).toBe(noon);
    expect(spanOf(LOW_SUN, "sunset").from).toBe(noon);
  });

  it("is dark all day when the sun stays below the night line", () => {
    expect(lightWindowSpan(DEEP_POLAR_NIGHT, "after-dark")).toEqual({
      from: 0,
      to: END_OF_NEXT_DAY,
    });
    expect(lightWindowSpan(DEEP_POLAR_NIGHT, "morning")).toBeNull();
  });

  it("never returns a span before the day, past its reach or ending before it starts", () => {
    for (const place of [MIDNIGHT_SUN, WHITE_NIGHT]) {
      for (let month = 1; month <= 12; month++) {
        const date = `2027-${String(month).padStart(2, "0")}-21`;
        const context = { ...place, date };
        for (const window of LIGHT_WINDOWS) {
          const span = lightWindowSpan(context, window);
          if (span === null) continue;
          expect(span.from).toBeGreaterThanOrEqual(0);
          expect(span.from).toBeLessThan(span.to);
          const latest = window === "after-dark" ? END_OF_NEXT_DAY : LATEST_LOW_SUN;
          expect(span.to).toBeLessThanOrEqual(latest);
        }
      }
    }
  });

  it("has no sunlit windows in a polar night, but still has the dark", () => {
    for (const window of ["sunrise", "morning", "midday", "afternoon", "sunset"] as const) {
      expect(lightWindowSpan(POLAR_NIGHT, window)).toBeNull();
    }
    expect(lightWindowSpan(POLAR_NIGHT, "after-dark")).not.toBeNull();
  });
});

describe("lightWindowSpan's memory of each day", () => {
  it("answers each place and day on its own, however the calls interleave", () => {
    const alicante = spanOf(ALICANTE, "sunset");
    const tromso = spanOf(MIDNIGHT_SUN, "sunset");
    expect(spanOf(ALICANTE, "sunset")).toEqual(alicante);
    expect(spanOf(MIDNIGHT_SUN, "sunset")).toEqual(tromso);
    expect(tromso).not.toEqual(alicante);
  });

  it("tells days apart by place, date and clock", () => {
    const sunset = spanOf(ALICANTE, "sunset");
    const { lat, lng } = ALICANTE.position;
    const variants: DayContext[] = [
      { ...ALICANTE, position: { lat: lat + 5, lng } },
      { ...ALICANTE, position: { lat, lng: lng + 5 } },
      { ...ALICANTE, date: "2026-12-14" },
      { ...ALICANTE, utcOffsetMinutes: ALICANTE.utcOffsetMinutes + 60 },
    ];
    for (const variant of variants) expect(spanOf(variant, "sunset")).not.toEqual(sunset);
  });

  it("hands out a copy, so changing one answer does not change the next", () => {
    const first = spanOf(ALICANTE, "morning");
    const expected = { ...first };
    first.from = 0;
    expect(spanOf(ALICANTE, "morning")).toEqual(expected);
  });

  it("still answers a day it has let go of", () => {
    const expected = spanOf(ALICANTE, "afternoon");
    // More days than it keeps, a hundredth of a degree apart.
    for (let step = 1; step <= 300; step++) {
      const position = { lat: ALICANTE.position.lat, lng: ALICANTE.position.lng + step / 100 };
      lightWindowSpan({ ...ALICANTE, position }, "afternoon");
    }
    expect(spanOf(ALICANTE, "afternoon")).toEqual(expected);
  });
});

describe("overlapMinutes", () => {
  it("counts the minutes two spans share", () => {
    expect(overlapMinutes({ from: 600, to: 700 }, { from: 650, to: 800 })).toBe(50);
    expect(overlapMinutes({ from: 600, to: 700 }, { from: 620, to: 640 })).toBe(20);
  });

  it("is zero for spans that do not meet", () => {
    expect(overlapMinutes({ from: 600, to: 700 }, { from: 700, to: 800 })).toBe(0);
    expect(overlapMinutes({ from: 600, to: 700 }, { from: 900, to: 1000 })).toBe(0);
  });
});

describe("isVisitedInWindow", () => {
  const window: MinuteSpan = { from: 1000, to: 1060 };

  it(`counts a visit that spends ${MIN_MINUTES_IN_WINDOW} minutes in the window`, () => {
    const visit = { from: window.to - MIN_MINUTES_IN_WINDOW, to: window.to + 60 };
    expect(isVisitedInWindow(visit, window)).toBe(true);
  });

  it("does not count a visit that only grazes it", () => {
    const visit = { from: window.to - MIN_MINUTES_IN_WINDOW + 1, to: window.to + 60 };
    expect(isVisitedInWindow(visit, window)).toBe(false);
  });
});
