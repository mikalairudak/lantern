import { daySlugOf } from "@/lib/days/address";
import { normalizedDayOf, shownSeasonAt, writtenSeasonsAt } from "@/lib/days/written/days";
import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import { firstSeasonOf, type WrittenSeason } from "@/lib/days/written/seasons";
import type { WrittenGist } from "./day";
import { shownEnergiesOf } from "./day-shape";

/**
 * The days Lantern has written, the quick starts', as the start screen needs them: each start's
 * words, with the facts and shape of one season of its day. A page calls it on the server, so
 * the client gets each day's words and shape without the normalizer or the days themselves.
 */
function poolOf(seasonAt: (slug: string) => WrittenSeason | null): WrittenGist[] {
  return WRITTEN_REQUESTS.map((request) => {
    const season = seasonAt(daySlugOf(request));
    if (!season) throw new Error(`No written day for ${request.city}`);
    const { itinerary } = normalizedDayOf(season.written);
    return { request, facts: itinerary.facts, energies: shownEnergiesOf(itinerary) };
  });
}

/** The pool as the start screen offers it at an instant: each city's season its page shows then. */
export function shownPool(now: Date): WrittenGist[] {
  return poolOf((slug) => shownSeasonAt(slug, now));
}

/**
 * The pool in each city's first season, read without the clock: for the tests and the lab's
 * matrices, whose cells stay the same from one day to the next.
 */
export function writtenPool(): WrittenGist[] {
  return poolOf((slug) => {
    const seasons = writtenSeasonsAt(slug);
    return seasons ? firstSeasonOf(seasons) : null;
  });
}
