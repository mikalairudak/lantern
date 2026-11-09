import { isVisitedInWindow, lightWindowSpan, type MinuteSpan } from "@/lib/geo/light-windows";
import type { Itinerary, LightWindow } from "@/lib/schema/itinerary.schema";
import {
  lightRuns,
  utcOffsetMinutes,
  type DayContext,
  type GeoPoint,
  type LightQuality,
  type LightRun,
} from "@/lib/geo/sun";
import { MINUTES_PER_DAY } from "@/lib/time/clock";

/**
 * Light inside the chart: how the time axis is drawn where the light turns, and whether a
 * stop is visited in its own best window. The model only says when a place is at its best;
 * the sun's position turns that into clock time.
 */

export type { MinuteSpan } from "@/lib/geo/light-windows";

/** Where and when the day happens, for the sun math. */
export function dayContextOf(itinerary: Itinerary): DayContext {
  const firstPlace = itinerary.stops[0]?.primary;
  return {
    position: firstPlace?.coordinates ?? { lat: 0, lng: 0 },
    date: itinerary.date,
    utcOffsetMinutes: utcOffsetMinutes(itinerary.timezone, itinerary.date),
  };
}

/**
 * How the time axis runs through a stretch of the day: in the lamp through golden hour,
 * dotted from sunset to sunrise, blue hour and night alike. Soft and clear daylight are the
 * axis itself, so the hours of plain day stay plain.
 */
export type AxisLight = "golden" | "dark";

const AXIS_LIGHTS: Partial<Record<LightQuality, AxisLight>> = {
  golden: "golden",
  blue: "dark",
  dark: "dark",
};

/** A stretch of the time axis in one light, in the day's running minutes. */
export interface AxisRun extends MinuteSpan {
  light: AxisLight;
  /** The minute its light began, before the frame cut it: steady while the frame springs. */
  key: number;
}

/**
 * A run the frame cuts shorter than this is not drawn: at the frame's edge a few minutes of
 * golden hour read as a stray mark, as Kyoto's seven minutes at 07:00 did, not as light.
 */
export const MIN_RUN_MINUTES = 10;

/** Two days of light, so a night that runs past midnight reaches the next morning. */
const RUNNING_DAYS = 2 * MINUTES_PER_DAY;

/**
 * The day's light from its midnight to the next day's end, in running minutes, as the sun
 * gives it at a clear sky. It is worked out minute by minute, so once for a day and its
 * place; `axisLightWithin` cuts it to the chart's frame as the frame moves.
 */
export function dayLightOf(context: DayContext): LightRun[] {
  return lightRuns(context, 0, RUNNING_DAYS);
}

/**
 * The runs of light the time axis shows between two running minutes of the day, cut to
 * them: blue hour and night are one dotted run, and a run cut shorter than
 * `MIN_RUN_MINUTES` is left plain.
 */
export function axisLightWithin(runs: readonly LightRun[], from: number, to: number): AxisRun[] {
  const whole = runs.reduce<AxisRun[]>((joined, run, index) => {
    const light = AXIS_LIGHTS[run.quality];
    const end = runs[index + 1]?.fromMinutes ?? RUNNING_DAYS;
    if (!light) return joined;
    const last = joined.at(-1);
    // Blue hour runs straight into night, so the two are one run of the dotted axis.
    if (last && last.light === light && last.to === run.fromMinutes) {
      return [...joined.slice(0, -1), { ...last, to: end }];
    }
    return [...joined, { light, from: run.fromMinutes, to: end, key: run.fromMinutes }];
  }, []);
  return whole.flatMap((run) => {
    const cut = { ...run, from: Math.max(run.from, from), to: Math.min(run.to, to) };
    return cut.to - cut.from >= MIN_RUN_MINUTES ? [cut] : [];
  });
}

/** The runs down to a running minute, the last one cut there: the light comes in with the day. */
export function axisLightTo(runs: readonly AxisRun[], to: number): AxisRun[] {
  return runs.flatMap((run) => (run.from < to ? [{ ...run, to: Math.min(run.to, to) }] : []));
}

/** Whether the axis runs in golden hour at a minute. */
export function isGoldenAt(runs: readonly AxisRun[], minute: number): boolean {
  return runs.some((run) => run.light === "golden" && minute >= run.from && minute < run.to);
}

/** Which of the sun's narrow windows a place is visited in. */
export type BestLight = "sunrise" | "sunset";

/**
 * The window a place is at its best in, if the visit holds twenty minutes of it, as the
 * light-sense check asks. The visit is in the day's running minutes, so a stop after
 * midnight meets an evening window that runs past it. The mark speaks about the visitor's
 * hour, not about the place: a place best at sunset that is visited at half past eight
 * gets no mark, never a "best at sunset" that would read as a verdict on the plan. Only
 * the sunrise and sunset windows are marked: morning, midday, afternoon and after-dark
 * last for hours, so their marks would sit on most rows and say nothing. A place whose
 * best window the stream has not written yet is not marked.
 */
export function bestLightOf(
  place: { coordinates?: Partial<GeoPoint>; light?: { bestWindow?: LightWindow | null } },
  visit: MinuteSpan,
  context: DayContext,
): BestLight | null {
  const window = place.light?.bestWindow;
  if (window !== "sunrise" && window !== "sunset") return null;
  const { lat, lng } = place.coordinates ?? {};
  const position = lat === undefined || lng === undefined ? context.position : { lat, lng };
  const span = lightWindowSpan({ ...context, position }, window);
  return span && isVisitedInWindow(visit, span) ? window : null;
}
