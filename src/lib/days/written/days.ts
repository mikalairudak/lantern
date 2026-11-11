import type { WrittenDay } from "./written-day";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { PlaceCheck } from "@/lib/places/verify-place";
import type { DayRequest, Itinerary } from "@/lib/schema/itinerary.schema";
import { daySlugOf } from "../address";
import { isSameRequest } from "../request";
import { firstStartOf } from "./requests";
import { firstSeasonOf, seasonOn, type WrittenSeason } from "./seasons";
import { isShownNear, shownDateOf } from "./shown-date";
import { CITY_SEASONS, START_SEASONS } from "./start-days";
import { writtenVersionFor } from "./version";

/**
 * Every city Lantern has written a day for, as its seasons, in the order of `WRITTEN_REQUESTS`:
 * the quick starts' and the city days', the only days the public site serves from a file.
 */
export const WRITTEN_SEASONS: readonly (readonly WrittenSeason[])[] = [
  ...START_SEASONS,
  ...CITY_SEASONS,
];

/** Every day Lantern has written ahead of time, each season of each city, in the same order. */
export const WRITTEN_DAYS: readonly WrittenDay[] = WRITTEN_SEASONS.flatMap((seasons) =>
  seasons.map(({ written }) => written),
);

/**
 * The season whose file answers this request at an instant, or null: a season's own request
 * word for word, or the city's words on a date its days are shown on, give or take
 * (`isShownNear`), which then picks the season (`seasonOn`). Every word has to match, not only
 * the city: the normalizer writes the request's words over the day, so a calm day served for a
 * lively request would claim a plan it never made.
 */
export function writtenSeasonFor(request: DayRequest, now: Date): WrittenSeason | null {
  for (const seasons of WRITTEN_SEASONS) {
    const own = seasons.find(({ written }) => isSameRequest(written.request, request));
    if (own) return own;
    if (isShownNear(firstSeasonOf(seasons).written.request, request, now)) {
      return seasonOn(seasons, request.date);
    }
  }
  return null;
}

/** The written day whose file answers this request at an instant, or null (`writtenSeasonFor`). */
export function writtenDayFor(request: DayRequest, now: Date): WrittenDay | null {
  return writtenSeasonFor(request, now)?.written ?? null;
}

/** A written day normalized on the server, whole: its address's page reads its line. */
export interface NormalizedDay {
  request: DayRequest;
  itinerary: Itinerary;
}

/** The seasons of the city whose address ends in this slug, oldest first, or null. */
export function writtenSeasonsAt(slug: string): readonly WrittenSeason[] | null {
  return (
    WRITTEN_SEASONS.find((seasons) => daySlugOf(firstSeasonOf(seasons).written.request) === slug) ??
    null
  );
}

/**
 * The written day whose address ends in this slug in its first season, the start's own,
 * normalized as its page draws it on the date it was written for, or null. The day a test or
 * the lab names a city by; a page reads the season its date picks (`shownWrittenDayAt`).
 */
export function writtenDayAt(slug: string): NormalizedDay | null {
  const seasons = writtenSeasonsAt(slug);
  return seasons ? normalizedDayOf(firstSeasonOf(seasons).written) : null;
}

/** The season of the city at this slug that its page shows at an instant, or null. */
export function shownSeasonAt(slug: string, now: Date): WrittenSeason | null {
  const seasons = writtenSeasonsAt(slug);
  return seasons ? seasonOn(seasons, shownDateAt(seasons, now)) : null;
}

/** A written day as its page shows it: the season's version and place checks with it. */
export interface ShownDay extends NormalizedDay {
  /** The season's version, worked out from its day as built (`writtenVersionFor`). */
  version: string;
  checks: Readonly<Record<string, PlaceCheck>>;
}

/**
 * The written day at this slug on the date it is shown on at an instant, from the season that
 * date picks, or null.
 */
export function shownWrittenDayAt(slug: string, now: Date): ShownDay | null {
  const seasons = writtenSeasonsAt(slug);
  if (!seasons) return null;
  const date = shownDateAt(seasons, now);
  const season = seasonOn(seasons, date);
  return {
    ...normalizedDayOn(season.written, date),
    version: writtenVersionFor(season.written),
    checks: season.checks,
  };
}

/**
 * The written day at this slug as a page that played it holds it, from the season the page's
 * date picks: on that date when the day is shown on it, give or take (`isShownNear`), and on the
 * season's own date otherwise. A re-plan reads its basis here, so the day it changes is the one
 * on screen, across a season's end too.
 */
export function writtenDayOn(slug: string, date: string, now: Date): NormalizedDay | null {
  const seasons = writtenSeasonsAt(slug);
  if (!seasons) return null;
  const { written } = seasonOn(seasons, date);
  const isShown = isShownNear(written.request, { ...written.request, date }, now);
  return isShown ? normalizedDayOn(written, date) : normalizedDayOf(written);
}

/** The date a city's days are shown on at an instant, read from its start alone. */
function shownDateAt(seasons: readonly WrittenSeason[], now: Date): string {
  const start = firstSeasonOf(seasons).written.request;
  return shownDateOf(start, firstStartOf(start), now);
}

/** A written day normalized on another date, which every date its stops and light read follows. */
export function normalizedDayOn(written: WrittenDay, date: string): NormalizedDay {
  return normalizedDayOf({ ...written, request: { ...written.request, date } });
}

/** A written day as its page draws it; a day that does not normalize is a broken build. */
export function normalizedDayOf({ request, day }: WrittenDay): NormalizedDay {
  const normalized = normalizeDay(request, day);
  if (!normalized.ok) throw new Error(`A written day does not normalize: ${normalized.reason}`);
  return { request, itinerary: normalized.itinerary };
}
