import { DAY_LINK_DAYS } from "@/lib/days/stored-day";
import { todayIn } from "@/lib/normalizer/normalize-intake";
import { KEPT_WAIT_MS } from "./kept-day";
import { chosenLabelsOf, energyLabelOf, weekdayOf } from "./sentence";
import type { YourDay } from "./your-days";

/**
 * What the ledger of the visitor's days says: its label and its controls' words, and of each
 * day, beside its city, the date's place, the day in the visitor's words, and how it ended when
 * it did not end written. A plain module, so tests and the lab read it without a browser.
 */

const MS_PER_DAY = 86_400_000;

/** Over the visitor's own days, above the index; it names their list. */
export const YOUR_DAYS_HEADING = "Your days";
/** Forgets the list in this browser; the days stay in the log until their link expires. */
export const FORGET_YOUR_DAYS = "Forget these days";

/**
 * The days shown before the visitor asks for all of them: the newest few, so the index stays
 * near the question on a phone however many days the visitor has.
 */
export const DAYS_SHOWN_AT_FIRST = 3;

/** The date's place while Lantern writes the day: as narrow as a date, so nothing moves. */
export const WRITING_SAID = "writing";

/**
 * Which date a row says: the day's own, which its words name ("Social Saturday"), or the day it
 * was asked for, which the order of the rows already says.
 */
export type LedgerDateKind = "day" | "asked";

const DATE_THIS_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DATE_ANOTHER_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Days from one ISO date to another, both read as whole days. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/**
 * A date beside today: "today", "tomorrow", "yesterday", then "21 Nov", with its year only when
 * it is not this one ("3 Jan 2027"). No weekday, since the row's words name it.
 */
export function calendarWordOf(date: string, today: string): string {
  const ahead = daysBetween(today, date);
  if (ahead === 0) return "today";
  if (ahead === 1) return "tomorrow";
  if (ahead === -1) return "yesterday";
  const isThisYear = date.slice(0, 4) === today.slice(0, 4);
  return (isThisYear ? DATE_THIS_YEAR : DATE_ANOTHER_YEAR).format(new Date(`${date}T12:00:00Z`));
}

/** A moment's date in the visitor's own calendar, as ISO. */
function localDateOf(moment: Date): string {
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const day = String(moment.getDate()).padStart(2, "0");
  return `${moment.getFullYear()}-${month}-${day}`;
}

/**
 * The date's place: "writing" while the day is written, whatever its date; otherwise the day's
 * own date read beside today in the day's own city, or the day it was asked for in the
 * visitor's calendar.
 */
export function ledgerDateOf(day: YourDay, now: Date, kind: LedgerDateKind = "day"): string {
  if (day.ending === "writing") return WRITING_SAID;
  if (kind === "asked")
    return calendarWordOf(localDateOf(new Date(day.startedAt)), localDateOf(now));
  return calendarWordOf(day.request.date, todayIn(day.request.timezone, now));
}

/**
 * Whether a day's link has passed its days. The server counts them from when the day was
 * written; the row counts from when it was asked plus the longest a day is waited for, so it
 * never says so before the server would. The row stays a link: the page it opens decides.
 */
export function isLinkExpired(day: YourDay, now: Date): boolean {
  return now.getTime() - Date.parse(day.startedAt) > KEPT_WAIT_MS + DAY_LINK_DAYS * MS_PER_DAY;
}

/**
 * How a day that did not end written and open ended, said after its words: the first that
 * holds of no day, a link past its days, and a day cut short. Null for a day being written and
 * one written whose link still opens it.
 */
export function ledgerEndingOf(day: YourDay, now: Date): string | null {
  if (day.ending === "writing") return null;
  if (day.ending === "failed") return "not finished";
  if (isLinkExpired(day, now)) return "link expired";
  if (day.ending === "cut") return "cut short";
  return null;
}

/** No day stands behind the row: none came, or its link has passed its days. */
export function hasNoDayBehind(day: YourDay, now: Date): boolean {
  const ending = ledgerEndingOf(day, now);
  return ending === "not finished" || ending === "link expired";
}

/** The day in the visitor's words, without "A … in <city>": "Social", "Sunday", "with friends". */
export interface LedgerWords {
  /** The energy's word with a capital, in the energy's colour. */
  energy: string;
  /** The weekday, then each word the visitor chose. */
  words: readonly string[];
}

export function ledgerWordsOf(day: YourDay): LedgerWords {
  const energy = energyLabelOf(day.request.energy);
  return {
    energy: `${energy.charAt(0).toUpperCase()}${energy.slice(1)}`,
    words: [weekdayOf(day.request.date), ...chosenLabelsOf(day.request)],
  };
}
