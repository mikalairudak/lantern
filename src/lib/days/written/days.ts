import type { WrittenDay } from "./written-day";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { DayRequest, Itinerary } from "@/lib/schema/itinerary.schema";
import { daySlugOf } from "../address";
import { isSameRequest } from "../request";
import { firstStartOf } from "./requests";
import { isShownNear, shownDateOf } from "./shown-date";
import { START_DAYS } from "./start-days";

/**
 * Every day Lantern has written ahead of time, in the order of `WRITTEN_REQUESTS`: the quick
 * starts', the only days the public site serves from a file.
 */
export const WRITTEN_DAYS: readonly WrittenDay[] = START_DAYS;

/**
 * The written day whose file answers this request at an instant, or null: its own request
 * word for word, or its words on a date it is shown on, give or take (`isShownNear`). Every
 * word has to match, not only the city: the normalizer writes the request's words over the
 * day, so a calm day served for a lively request would claim a plan it never made.
 */
export function writtenDayFor(request: DayRequest, now: Date): WrittenDay | null {
  return (
    WRITTEN_DAYS.find(
      (written) =>
        isSameRequest(written.request, request) || isShownNear(written.request, request, now),
    ) ?? null
  );
}

/** A written day normalized on the server, whole: its address's page reads its line. */
export interface NormalizedDay {
  request: DayRequest;
  itinerary: Itinerary;
}

/**
 * The written day whose address ends in this slug, normalized as its page draws it, on the date
 * it was written for, or null.
 */
export function writtenDayAt(slug: string): NormalizedDay | null {
  const written = writtenAt(slug);
  return written ? normalizedDayOf(written) : null;
}

/** The written day at this slug on the date it is shown on at an instant, or null. */
export function shownWrittenDayAt(slug: string, now: Date): NormalizedDay | null {
  const written = writtenAt(slug);
  if (!written) return null;
  return normalizedDayOn(written, shownDateOf(written.request, firstStartOf(written.request), now));
}

/**
 * The written day at this slug as a page that played it holds it: on the date the page names
 * when the day is shown on that date, give or take (`isShownNear`), and on its own date
 * otherwise. A re-plan reads its basis here, so the day it changes is the one on screen.
 */
export function writtenDayOn(slug: string, date: string, now: Date): NormalizedDay | null {
  const written = writtenAt(slug);
  if (!written) return null;
  const isShown = isShownNear(written.request, { ...written.request, date }, now);
  return isShown ? normalizedDayOn(written, date) : normalizedDayOf(written);
}

function writtenAt(slug: string): WrittenDay | null {
  return WRITTEN_DAYS.find(({ request }) => daySlugOf(request) === slug) ?? null;
}

/** A written day normalized on another date, which every date its stops and light read follows. */
function normalizedDayOn(written: WrittenDay, date: string): NormalizedDay {
  return normalizedDayOf({ ...written, request: { ...written.request, date } });
}

/** A written day as its page draws it; a day that does not normalize is a broken build. */
export function normalizedDayOf({ request, day }: WrittenDay): NormalizedDay {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(`A written day does not normalize: ${normalized.reason}`);
  return { request, itinerary: normalized.itinerary };
}
