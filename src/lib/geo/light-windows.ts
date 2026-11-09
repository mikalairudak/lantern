import type { LightWindow } from "@/lib/schema/itinerary.schema";
import {
  GOLDEN_ALTITUDE,
  NIGHT_ALTITUDE,
  SUNRISE_ALTITUDE,
  sunAltitude,
  type DayContext,
} from "./sun";

/** Minutes after local midnight, `to` excluded. */
export interface MinuteSpan {
  from: number;
  to: number;
}

/** Midday reaches this far either side of the sun's own noon. */
const MIDDAY_HALF_SPAN_MINUTES = 120;
const END_OF_DAY_MINUTES = 24 * 60;
/** How long a night with no first light at its end lasts: through the next day. */
const END_OF_NEXT_DAY_MINUTES = 2 * END_OF_DAY_MINUTES;
/** From the sun's noon to its lowest point, near enough: the day's solar half. */
const HALF_DAY_MINUTES = 12 * 60;

/** The sun over one day, from its lowest point before noon to the next day's noon. */
interface SunDay {
  /** The minute the sun is highest. */
  noon: number;
  /** Its altitude then. */
  peak: number;
  /** The sun's lowest points either side of noon. */
  lowBefore: number;
  lowAfter: number;
  /** When the sun climbs past an altitude on its way to noon, or null if it never crosses it. */
  risingBefore: (altitude: number) => number | null;
  /** When the sun sinks past an altitude after noon, or null if it never crosses it. */
  settingAfter: (altitude: number) => number | null;
  /** When the sun next climbs past an altitude after a minute, before the next day's noon. */
  risingAfter: (altitude: number, minute: number) => number | null;
}

function sunOver(context: DayContext): SunDay {
  let noon = 0;
  let peak = -Infinity;
  for (let minute = 0; minute < END_OF_DAY_MINUTES; minute++) {
    const altitude = sunAltitude(context, minute);
    if (altitude > peak) {
      peak = altitude;
      noon = minute;
    }
  }
  const lowBefore = noon - HALF_DAY_MINUTES;
  const lowAfter = noon + HALF_DAY_MINUTES;
  const nextNoon = noon + END_OF_DAY_MINUTES;
  const altitudes = Array.from({ length: nextNoon - lowBefore + 1 }, (_, index) =>
    sunAltitude(context, lowBefore + index),
  );
  const altitudeAt = (minute: number): number => altitudes[minute - lowBefore] ?? peak;

  return {
    noon,
    peak,
    lowBefore,
    lowAfter,
    risingBefore: (altitude) => {
      for (let minute = noon; minute > lowBefore; minute--) {
        if (altitudeAt(minute - 1) < altitude && altitudeAt(minute) >= altitude) return minute;
      }
      return null;
    },
    settingAfter: (altitude) => {
      for (let minute = noon + 1; minute <= lowAfter; minute++) {
        if (altitudeAt(minute - 1) >= altitude && altitudeAt(minute) < altitude) return minute;
      }
      return null;
    },
    risingAfter: (altitude, after) => {
      for (let minute = after + 1; minute <= nextNoon; minute++) {
        if (altitudeAt(minute - 1) < altitude && altitudeAt(minute) >= altitude) return minute;
      }
      return null;
    },
  };
}

/**
 * A window starts no earlier than the day's midnight. It may end after the next one, in the
 * same running minutes as a visit from 23:45 to 00:40 (1425 to 1480): under the midnight
 * sun, the sunset light lasts until the sun's lowest point, at about 00:46.
 */
function spanInDay(from: number | null, to: number | null): MinuteSpan | null {
  if (from === null || to === null) return null;
  const span = { from: Math.max(from, 0), to };
  return span.from < span.to ? span : null;
}

/** How many days' windows to keep: a day's stops and their swaps, with room to spare. */
const CACHED_DAYS = 256;
const windowsByDay = new Map<string, Record<LightWindow, MinuteSpan | null>>();

/**
 * When a light window falls on one day at one place, worked out from the sun, so the
 * windows move with the season and the latitude. Each is anchored on the sun's noon, so a
 * sunset after midnight, as in Reykjavík in June, still belongs to its own day:
 *
 * - sunrise: from first light (civil dawn) until the morning's golden light turns soft;
 * - morning: from sunrise to the sun's noon;
 * - midday: two hours either side of the sun's noon;
 * - afternoon: from the sun's noon to sunset;
 * - sunset: from the evening's golden light until the blue hour ends;
 * - after-dark: from the end of the blue hour until first light the next morning.
 *
 * Where the sun never reaches a boundary, its lowest point stands in: under the midnight
 * sun, morning starts and sunset ends there, past midnight, and a day whose sun stays low
 * is golden from dawn to dusk. After-dark runs past midnight, as a day's stops do
 * (`runningSpans`), so a club from one in the morning is in the dark it was planned for;
 * a sun that never climbs out of the night keeps it dark from midnight until the next
 * first light, or through the next day when none comes. Null when the sun does not make
 * that window: the sunlit ones in a polar night, golden light under a sun that never sinks
 * below it, and the dark in a white night.
 *
 * A place's best-light mark and the light-sense check read the windows from here. Working
 * out one day's sun takes about 3,600 altitudes, and the sun does not move while a visitor
 * drags, so each day's six windows are kept for the next call.
 */
export function lightWindowSpan(context: DayContext, window: LightWindow): MinuteSpan | null {
  const span = windowsOf(context)[window];
  // A copy, so a caller that changes it cannot change the next caller's answer.
  return span && { ...span };
}

function windowsOf(context: DayContext): Record<LightWindow, MinuteSpan | null> {
  const { position, date, utcOffsetMinutes } = context;
  const key = `${position.lat},${position.lng},${date},${utcOffsetMinutes}`;
  const cached = windowsByDay.get(key);
  if (cached) return cached;

  const sun = sunOver(context);
  const windows: Record<LightWindow, MinuteSpan | null> = {
    sunrise: windowFrom(sun, "sunrise"),
    morning: windowFrom(sun, "morning"),
    midday: windowFrom(sun, "midday"),
    afternoon: windowFrom(sun, "afternoon"),
    sunset: windowFrom(sun, "sunset"),
    "after-dark": windowFrom(sun, "after-dark"),
  };
  if (windowsByDay.size >= CACHED_DAYS) {
    const oldest = windowsByDay.keys().next();
    if (!oldest.done) windowsByDay.delete(oldest.value);
  }
  windowsByDay.set(key, windows);
  return windows;
}

function windowFrom(sun: SunDay, window: LightWindow): MinuteSpan | null {
  if (window === "after-dark") {
    const dusk = sun.settingAfter(NIGHT_ALTITUDE);
    // Never above the night line, it is dark all day; never below it, it never gets dark.
    const nightFrom = dusk ?? (sun.peak < NIGHT_ALTITUDE ? 0 : null);
    const firstLight = sun.risingAfter(NIGHT_ALTITUDE, dusk ?? sun.noon);
    return spanInDay(nightFrom, firstLight ?? END_OF_NEXT_DAY_MINUTES);
  }
  if (sun.peak < SUNRISE_ALTITUDE) return null;

  // A sun that never climbs out of the golden band keeps it until noon and after.
  const goldenUntilNoon = sun.peak < GOLDEN_ALTITUDE ? sun.noon : null;
  switch (window) {
    case "sunrise":
      return spanInDay(
        sun.risingBefore(NIGHT_ALTITUDE) ?? sun.lowBefore,
        sun.risingBefore(GOLDEN_ALTITUDE) ?? goldenUntilNoon,
      );
    case "morning":
      return spanInDay(sun.risingBefore(SUNRISE_ALTITUDE) ?? sun.lowBefore, sun.noon);
    case "midday":
      return spanInDay(sun.noon - MIDDAY_HALF_SPAN_MINUTES, sun.noon + MIDDAY_HALF_SPAN_MINUTES);
    case "afternoon":
      return spanInDay(sun.noon, sun.settingAfter(SUNRISE_ALTITUDE) ?? sun.lowAfter);
    case "sunset":
      return spanInDay(
        sun.settingAfter(GOLDEN_ALTITUDE) ?? goldenUntilNoon,
        sun.settingAfter(NIGHT_ALTITUDE) ?? sun.lowAfter,
      );
  }
}

/** Minutes two spans share. */
export function overlapMinutes(a: MinuteSpan, b: MinuteSpan): number {
  return Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from));
}

/**
 * A visit that only grazes its window is not there for the light. The light-sense check
 * and the light mark on a stop both read this, so they cannot drift apart.
 */
export const MIN_MINUTES_IN_WINDOW = 20;

/** Whether a visit spends long enough in a light window to be there for the light. */
export function isVisitedInWindow(visit: MinuteSpan, window: MinuteSpan): boolean {
  return overlapMinutes(visit, window) >= MIN_MINUTES_IN_WINDOW;
}
