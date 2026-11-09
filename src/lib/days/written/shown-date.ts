import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { parseClock } from "@/lib/time/clock";
import { isSameWords } from "../request";

/**
 * The date a written day is shown on (`docs/decisions.md`, "A written day is shown on the next
 * date of its weekday"). Each was written for one weekday, and is shown on the nearest date of
 * that weekday still ahead in its city, so its facts, its light and the calendar it saves never
 * stand in the past. Its file keeps the date it was written for, which the tests and the lab
 * read.
 */

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const MINUTES_PER_HOUR = 60;
/**
 * How many days before today in its city a date may stand and still be one a written day is
 * shown on: a page drawn before its date moved on, or a browser whose clock runs a day behind.
 */
const DAYS_BEHIND = 1;

/** A city's calendar date and minute of the day at an instant. */
export interface CityClock {
  /** As ISO 8601: "2026-11-14". */
  date: string;
  /** From the city's midnight. */
  minutes: number;
}

/** The date and the minute of the day in a zone at an instant, whatever the server's zone. */
export function cityClockOf(timezone: string, now: Date): CityClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((each) => each.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * MINUTES_PER_HOUR + Number(part("minute")),
  };
}

/** A calendar date as days from 1970-01-01. */
function dayNumberOf(date: string): number {
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function dateOf(dayNumber: number): string {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

/** A calendar date's weekday, Sunday 0. */
function weekdayOf(date: string): number {
  return new Date(dayNumberOf(date) * MS_PER_DAY).getUTCDay();
}

/**
 * The date a written day is shown on at an instant: the nearest date of its weekday in its
 * city, today while its first stop has not begun there. A day already under way is never
 * offered, nor a calendar that saves stops already past.
 */
export function shownDateOf(written: DayRequest, firstStart: string, now: Date): string {
  const start = parseClock(firstStart);
  if (start === null) throw new Error(`A written day's first stop has no time: "${firstStart}"`);
  const today = cityClockOf(written.timezone, now);
  const ahead = (weekdayOf(written.date) - weekdayOf(today.date) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const isUnderWay = ahead === 0 && today.minutes >= start;
  return dateOf(dayNumberOf(today.date) + (isUnderWay ? DAYS_PER_WEEK : ahead));
}

/** Whether a request asks for a written day's words on its weekday, whatever the date. */
export function isOnItsWeekday(written: DayRequest, request: DayRequest): boolean {
  return isSameWords(written, request) && weekdayOf(written.date) === weekdayOf(request.date);
}

/**
 * Whether a request asks for a written day on a date it is shown on, give or take: its words,
 * on its weekday, from yesterday to a week from today in its city. Only such a request plays
 * from the day's file; a date further out is a day of its own.
 */
export function isShownNear(written: DayRequest, request: DayRequest, now: Date): boolean {
  if (!isOnItsWeekday(written, request)) return false;
  const today = dayNumberOf(cityClockOf(written.timezone, now).date);
  const offset = dayNumberOf(request.date) - today;
  return offset >= -DAYS_BEHIND && offset <= DAYS_PER_WEEK;
}
