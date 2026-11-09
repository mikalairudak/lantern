import type { PlaceChecks } from "@/features/itinerary/use-day-stream";
import { utcOffsetMinutes } from "@/lib/geo/sun";
import type { Stop } from "@/lib/schema/itinerary.schema";
import { MINUTES_PER_DAY, runningSpans } from "@/lib/time/clock";
import { placePointOf, shownPlacesOf } from "./day-end";

/**
 * A day as a calendar file (RFC 5545), made in the browser: one event per stop, for the version
 * it shows, in the day's own time zone, so a phone puts each visit at its local hour wherever
 * the traveller's phone thinks it is.
 *
 * The model's words go into the file as text alone: a place's name is the event's summary, its
 * quarter and the city its location, its summary the description. Each is escaped as RFC 5545
 * asks (a backslash, a semicolon, a comma and a line break written out, every other control
 * character dropped) and every line folded at 75 octets, so no name can end a line, start a
 * property or close an event. The time zone, the coordinates and the ids are Lantern's own and
 * checked for their form before they are written.
 */

/** What a browser is told the file is. */
export const CALENDAR_TYPE = "text/calendar;charset=utf-8";

/** The day a calendar file is made of. */
export interface CalendarDay {
  /**
   * The day's key on this device (`seenKeyOf`, `keptSeenKeyOf`): an event's id is made of it and
   * its stop's, so a file saved again after a version is changed updates the same events.
   */
  key: string;
  city: string;
  /** "2026-11-14": the day's date, in its own time zone. */
  date: string;
  /** The day's IANA time zone, "Asia/Tokyo". */
  timezone: string;
  stops: readonly Stop[];
  /** The index among its versions each stop shows (the curve's `committed`). */
  shown: readonly number[];
  checks?: PlaceChecks;
  /** The day's link, which each event carries. */
  url?: string;
}

const CRLF = "\r\n";
/** RFC 5545, 3.1: a line is folded once it would pass 75 octets. */
const MAX_LINE_OCTETS = 75;
const COORDINATE_DIGITS = 6;
/** An IANA zone's name: letters, digits, `_`, `+`, `-` and `/`; nothing a parameter must quote. */
const ZONE_NAME = /^[A-Za-z0-9_+/-]+$/;
const UID_HOST = "lanternday.com";
const PRODUCT_ID = "-//Lantern//Lantern day//EN";
const MINUTES_PER_HOUR = 60;
const MS_PER_DAY = 86_400_000;

/**
 * Text as an RFC 5545 TEXT value: the four characters it gives a meaning escaped, a line break
 * of any kind written as `\n`, and every other control character dropped, C1 included.
 */
export function escapeText(text: string): string {
  return text
    .replace(/\r\n|\r|\n|\u2028|\u2029/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function octetsOf(character: string): number {
  const code = character.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  return code < 0x10000 ? 3 : 4;
}

/**
 * A content line folded as RFC 5545 asks: no line past 75 octets, each one after the first
 * begun with a space, and never inside a character's UTF-8 bytes.
 */
export function foldLine(line: string): string {
  const lines: string[] = [];
  let current = "";
  let octets = 0;
  for (const character of line) {
    const size = octetsOf(character);
    if (octets + size > MAX_LINE_OCTETS) {
      lines.push(current);
      current = " ";
      octets = 1;
    }
    current += character;
    octets += size;
  }
  lines.push(current);
  return lines.join(CRLF);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** "20261114T073000": a local date and time, minutes from the date's midnight running past it. */
function localDateTime(date: string, minutes: number): string {
  const day = new Date(
    Date.parse(`${date}T00:00:00Z`) + Math.floor(minutes / MINUTES_PER_DAY) * MS_PER_DAY,
  );
  const ofDay = minutes % MINUTES_PER_DAY;
  const ymd = `${day.getUTCFullYear()}${twoDigits(day.getUTCMonth() + 1)}${twoDigits(day.getUTCDate())}`;
  return `${ymd}T${twoDigits(Math.floor(ofDay / MINUTES_PER_HOUR))}${twoDigits(ofDay % MINUTES_PER_HOUR)}00`;
}

/** "20261105T101500Z": an instant in UTC. */
function utcDateTime(instant: Date): string {
  return `${instant.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** "+0900", "-0330": an offset as a time zone's definition writes it. */
function offsetWords(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const whole = Math.abs(minutes);
  return `${sign}${twoDigits(Math.floor(whole / MINUTES_PER_HOUR))}${twoDigits(whole % MINUTES_PER_HOUR)}`;
}

/** An id's part as a calendar's event id takes it: letters, digits and hyphens. */
function idPart(text: string): string {
  return text.replace(/[^A-Za-z0-9-]/g, "-");
}

function coordinate(value: number): string {
  return String(Number(value.toFixed(COORDINATE_DIGITS)));
}

/**
 * The zone's definition the events' times refer to, which RFC 5545 asks for beside every TZID:
 * the offset it keeps at noon on the day, as the chart's sun is worked out. A day that crosses
 * a change of clocks keeps the noon offset through it.
 */
function zoneLines(timezone: string, date: string): string[] {
  const offset = offsetWords(utcOffsetMinutes(timezone, date));
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${timezone}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

/** The day's link, if it is a plain web address, as a calendar's URL property takes it. */
function urlLine(url: string | undefined): string[] {
  return url !== undefined && /^https?:\/\/[^\s"<>\\^`{|}\u0000-\u001F\u007F]+$/.test(url)
    ? [`URL:${url}`]
    : [];
}

/**
 * The calendar file of the day: one event per stop, at its local hours in the day's zone, for
 * the place it shows. `now` stamps the events, as RFC 5545 asks.
 */
export function calendarOf(day: CalendarDay, now: Date): string {
  const isZoned = ZONE_NAME.test(day.timezone);
  // A zone name of any other form is no zone of a city, and the times are left floating.
  const zoned = isZoned ? `;TZID=${day.timezone}` : "";
  const places = shownPlacesOf(day.stops, day.shown);
  const spans = runningSpans(day.stops);
  const stamp = utcDateTime(now);
  const events = day.stops.flatMap((stop, index) => {
    const place = places[index]!;
    const span = spans[index]!;
    const point = placePointOf(place, day.checks ?? {});
    const isOnMap = Number.isFinite(point.lat) && Number.isFinite(point.lng);
    return [
      "BEGIN:VEVENT",
      `UID:${idPart(day.key)}-${idPart(stop.id)}@${UID_HOST}`,
      `DTSTAMP:${stamp}`,
      `DTSTART${zoned}:${localDateTime(day.date, span.from)}`,
      `DTEND${zoned}:${localDateTime(day.date, span.to)}`,
      `SUMMARY:${escapeText(place.name)}`,
      `LOCATION:${escapeText(`${place.neighborhood}, ${day.city}`)}`,
      ...(isOnMap ? [`GEO:${coordinate(point.lat)};${coordinate(point.lng)}`] : []),
      `DESCRIPTION:${escapeText(place.summary)}`,
      ...urlLine(day.url),
      "END:VEVENT",
    ];
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(isZoned ? zoneLines(day.timezone, day.date) : []),
    ...events,
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** "lantern-kyoto-2026-11-14.ics": the file's name, from the day's address and date. */
export function calendarFileNameOf(slug: string, date: string): string {
  return `lantern-${idPart(slug)}-${idPart(date)}.ics`;
}
