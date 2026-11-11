import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { isSameRequest } from "../request";
import { CITY_DAYS, CITY_REQUESTS } from "./city-days";
import { QUICK_STARTS, START_REQUESTS } from "./quick-starts";
import { isOnItsWeekday, shownDateOf } from "./shown-date";

/**
 * Every day Lantern has written ahead of time, requests only: the six the quick starts open and
 * the seven city days (`city-days.ts`), all of which the product wrote itself (`docs/decisions.md`,
 * "The public site offers only days the product wrote"): the three written by hand, Kyoto's,
 * Alicante's and Lisbon's, stay as fixtures for the tests and the lab, and a visitor gets them as
 * any other city. Each written day has its address and plays from the route without a model
 * call. The start screen's index offers eight of them (`INDEX_REQUESTS`), and the other lists
 * the quick starts' (`START_REQUESTS`).
 */
export const WRITTEN_REQUESTS: readonly DayRequest[] = [...START_REQUESTS, ...CITY_REQUESTS];

/**
 * The written request a request asks for: the same one, or its words on its weekday at
 * another date, as a page shows it (`shownDateOf`). Read without the clock, so a page can say
 * it while it renders; whether the day's file answers that date is the route's to say
 * (`writtenDayFor`).
 */
export function writtenRequestOf(request: DayRequest): DayRequest | null {
  return WRITTEN_REQUESTS.find((written) => isOnItsWeekday(written, request)) ?? null;
}

/**
 * Whether a request is one Lantern has written, on any date of its weekday. A page can say so
 * before anything streams; with live generation off any other request ends as `unavailable`.
 */
export function isWrittenRequest(request: DayRequest): boolean {
  return writtenRequestOf(request) !== null;
}

const FIRST_STARTS: ReadonlyMap<DayRequest, string> = new Map(
  [...QUICK_STARTS, ...CITY_DAYS].map(({ request, firstStart }) => [request, firstStart]),
);

/** When a written request's first stop begins in its city, as its start or city day keeps it. */
export function firstStartOf(written: DayRequest): string {
  const firstStart = FIRST_STARTS.get(written);
  if (firstStart === undefined) throw new Error(`No written day for ${written.city}`);
  return firstStart;
}

/**
 * A request as Lantern plays it: a written day's, word for word as its file names it, on the
 * date it is shown on at this instant; any other as it is. Every press of a written day passes
 * here, so a day opened from a list is on the date its own page shows.
 */
export function shownRequestOf(request: DayRequest, now: Date): DayRequest {
  const written = WRITTEN_REQUESTS.find((each) => isSameRequest(each, request));
  if (written === undefined) return request;
  return { ...request, date: shownDateOf(written, firstStartOf(written), now) };
}
