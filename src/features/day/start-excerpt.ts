import { dayContextOf } from "@/features/abacus/light";
import { daySlugOf } from "@/lib/days/address";
import { shownWrittenDayAt } from "@/lib/days/written/days";
import { QUICK_STARTS } from "@/lib/days/written/quick-starts";
import type { DayContext } from "@/lib/geo/sun";
import type { DayRequest, Stop } from "@/lib/schema/itinerary.schema";

/** How many of the day's first stops the start screen's excerpt shows. */
export const EXCERPT_STOPS = 3;

/**
 * A still excerpt of a day Lantern has written, for the start screen under its ways in
 * (`docs/decisions.md`, "The start screen is an index, with a day's first stops under it"): its
 * sentence, its line, its first stops on the plan, and its address. Worked out on the server, so
 * the page holds three stops rather than a whole day, and nothing streams.
 */
export interface StartExcerpt {
  address: string;
  request: DayRequest;
  dek: string;
  stops: Stop[];
  /** How many stops the whole day has, which its link says. */
  total: number;
  daylight: DayContext;
}

/**
 * The first start's day as its page shows it now, its season and date included, cut to its
 * first stops; null if its day is not written.
 */
export function startExcerptOf(now: Date): StartExcerpt | null {
  const first = QUICK_STARTS[0];
  if (!first) return null;
  const slug = daySlugOf(first.request);
  const written = shownWrittenDayAt(slug, now);
  if (!written) return null;
  const { itinerary } = written;
  return {
    address: `/day/${slug}`,
    request: written.request,
    dek: itinerary.dek,
    stops: itinerary.stops.slice(0, EXCERPT_STOPS),
    total: itinerary.stops.length,
    daylight: dayContextOf(itinerary),
  };
}
