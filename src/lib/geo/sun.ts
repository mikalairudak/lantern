import type { Coordinates } from "@/lib/schema/itinerary.schema";

/**
 * Sun position and light quality for a place and a day, used by the abacus's light and its
 * rows, the written day's header, the light-sense check and the concepts. NOAA's solar position
 * equations, good to about a tenth of a degree, which is far finer than any light label needs.
 */

/** Where the sun is read from: a place's point, by the name the light code uses. */
export type GeoPoint = Coordinates;

/** Where and when a day happens: a place, a calendar date and that date's UTC offset. */
export interface DayContext {
  position: GeoPoint;
  date: string;
  utcOffsetMinutes: number;
}

export type LightQuality = "golden" | "soft" | "clear" | "blue" | "dark";

export interface LightRun {
  quality: LightQuality;
  fromMinutes: number;
}

const RAD = Math.PI / 180;
const MINUTES_PER_DAY = 1440;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JULIAN_DAY = 2440587.5;
const J2000_JULIAN_DAY = 2451545;
const DAYS_PER_CENTURY = 36525;

/** The sun's upper edge touches the horizon, allowing for refraction. */
export const SUNRISE_ALTITUDE = -0.833;
/** Civil twilight ends: the blue hour is over and it is night. */
export const NIGHT_ALTITUDE = -6;
/** The sun is high enough that the golden light turns soft. */
export const GOLDEN_ALTITUDE = 6;
const SOFT_ALTITUDE = 20;

const OFFSET_PATTERN = /GMT([+-])(\d{2}):(\d{2})/;

/** The UTC offset a time zone uses at noon on a date, in minutes (Madrid in November: 60). */
export function utcOffsetMinutes(timeZone: string, date: string): number {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(noonUtc)
    .find((part) => part.type === "timeZoneName");
  const match = OFFSET_PATTERN.exec(parts?.value ?? "");
  if (!match) return 0; // "GMT" alone means UTC itself.
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Degrees above the horizon at a local clock time, given in minutes after midnight. */
export function sunAltitude(context: DayContext, localMinutes: number): number {
  const { position, date, utcOffsetMinutes: offset } = context;
  const ms = Date.parse(`${date}T00:00:00Z`) + (localMinutes - offset) * MS_PER_MINUTE;
  const t = (ms / MS_PER_DAY + UNIX_EPOCH_JULIAN_DAY - J2000_JULIAN_DAY) / DAYS_PER_CENTURY;

  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center =
    Math.sin(meanAnomaly * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnomaly * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnomaly * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = meanLongitude + center - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const obliquity =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 +
    0.00256 * Math.cos(omega * RAD);
  const declination =
    Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLongitude * RAD)) / RAD;

  const y = Math.tan((obliquity / 2) * RAD) ** 2;
  const equationOfTime =
    (4 / RAD) *
    (y * Math.sin(2 * meanLongitude * RAD) -
      2 * eccentricity * Math.sin(meanAnomaly * RAD) +
      4 * eccentricity * y * Math.sin(meanAnomaly * RAD) * Math.cos(2 * meanLongitude * RAD) -
      0.5 * y * y * Math.sin(4 * meanLongitude * RAD) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly * RAD));

  const solarMinutes =
    (((localMinutes + equationOfTime + 4 * position.lng - offset) % MINUTES_PER_DAY) +
      MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hourAngle = solarMinutes / 4 - 180;
  const cosZenith =
    Math.sin(position.lat * RAD) * Math.sin(declination * RAD) +
    Math.cos(position.lat * RAD) * Math.cos(declination * RAD) * Math.cos(hourAngle * RAD);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZenith))) / RAD;
}

export function lightQuality(altitude: number): LightQuality {
  if (altitude < NIGHT_ALTITUDE) return "dark";
  if (altitude < SUNRISE_ALTITUDE) return "blue";
  if (altitude < GOLDEN_ALTITUDE) return "golden";
  if (altitude < SOFT_ALTITUDE) return "soft";
  return "clear";
}

/** How the light changes over a span, as runs of one quality each, minute by minute. */
export function lightRuns(context: DayContext, fromMinutes: number, toMinutes: number): LightRun[] {
  const runs: LightRun[] = [];
  for (let minute = fromMinutes; minute < toMinutes; minute++) {
    const quality = lightQuality(sunAltitude(context, minute));
    if (runs.at(-1)?.quality !== quality) runs.push({ quality, fromMinutes: minute });
  }
  return runs;
}

/** The first minute of the day the sun crosses an altitude, rising or setting. */
export function sunCrossing(
  context: DayContext,
  altitude: number,
  direction: "rising" | "setting",
): number | null {
  const isRising = direction === "rising";
  for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
    const before = sunAltitude(context, minute);
    const after = sunAltitude(context, minute + 1);
    const crossesUp = before < altitude && after >= altitude;
    const crossesDown = before >= altitude && after < altitude;
    if (isRising ? crossesUp : crossesDown) return minute + 1;
  }
  return null;
}
