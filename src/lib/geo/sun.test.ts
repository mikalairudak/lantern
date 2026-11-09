import { describe, expect, it } from "vitest";
import { minutesOf } from "@/lib/time/clock";
import {
  NIGHT_ALTITUDE,
  SUNRISE_ALTITUDE,
  lightQuality,
  lightRuns,
  sunAltitude,
  sunCrossing,
  utcOffsetMinutes,
  type DayContext,
} from "./sun";

const TOLERANCE_MINUTES = 3;
const LONDON = { lat: 51.5074, lng: -0.1278 };
const TROMSO = { lat: 69.6492, lng: 18.9553 };

describe("utcOffsetMinutes", () => {
  it("reads daylight saving from the date", () => {
    expect(utcOffsetMinutes("Europe/London", "2026-06-21")).toBe(60);
    expect(utcOffsetMinutes("Europe/London", "2026-12-21")).toBe(0);
    expect(utcOffsetMinutes("Europe/Madrid", "2026-11-14")).toBe(60);
    expect(utcOffsetMinutes("America/New_York", "2026-11-14")).toBe(-300);
  });
});

describe("sunAltitude", () => {
  // Published almanac times for London on the 2026 summer solstice: sunrise 04:43,
  // sunset 21:21 BST.
  const londonSolstice: DayContext = {
    position: LONDON,
    date: "2026-06-21",
    utcOffsetMinutes: 60,
  };

  it("finds no sunrise in a polar night", () => {
    const tromsoWinter: DayContext = { position: TROMSO, date: "2026-12-21", utcOffsetMinutes: 60 };

    expect(sunCrossing(tromsoWinter, SUNRISE_ALTITUDE, "rising")).toBeNull();
  });

  it("puts London's solstice sunrise and sunset within minutes of the almanac", () => {
    const sunrise = sunCrossing(londonSolstice, SUNRISE_ALTITUDE, "rising");
    const sunset = sunCrossing(londonSolstice, SUNRISE_ALTITUDE, "setting");

    expect(Math.abs((sunrise ?? 0) - minutesOf("04:43"))).toBeLessThanOrEqual(TOLERANCE_MINUTES);
    expect(Math.abs((sunset ?? 0) - minutesOf("21:21"))).toBeLessThanOrEqual(TOLERANCE_MINUTES);
  });

  it("peaks near 90° minus latitude plus the solstice tilt", () => {
    const solarNoon = minutesOf("13:02");

    expect(sunAltitude(londonSolstice, solarNoon)).toBeCloseTo(90 - 51.5074 + 23.44, 0);
  });

  it("is below the horizon at midnight", () => {
    expect(sunAltitude(londonSolstice, 0)).toBeLessThan(NIGHT_ALTITUDE);
  });
});

describe("lightQuality", () => {
  it.each([
    [-12, "dark"],
    [-3, "blue"],
    [2, "golden"],
    [12, "soft"],
    [35, "clear"],
  ] as const)("calls %d° %s", (altitude, quality) => {
    expect(lightQuality(altitude)).toBe(quality);
  });
});

describe("lightRuns", () => {
  it("splits a span that runs through sunset into its qualities, in order", () => {
    const alicante: DayContext = {
      position: { lat: 38.3452, lng: -0.481 },
      date: "2026-11-14",
      utcOffsetMinutes: 60,
    };

    const runs = lightRuns(alicante, minutesOf("16:30"), minutesOf("18:30"));

    expect(runs.map((run) => run.quality)).toEqual(["soft", "golden", "blue", "dark"]);
    expect(runs[0]?.fromMinutes).toBe(minutesOf("16:30"));
  });
});
