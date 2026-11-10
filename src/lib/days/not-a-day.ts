import { DAY_ID_PATTERN } from "./stored-day";
import { daySlugOf } from "./slug";
import { START_REQUESTS } from "./written/quick-starts";

// Read by next.config.ts, whose loader does not resolve the `@/` alias: relative imports only,
// type imports aside, which compile away.

/**
 * Every address under `/day` that can name no day, as a route's `source` for the router to
 * match: one segment that is neither a written day's slug, the starts' (`WRITTEN_REQUESTS`),
 * nor a day's id. A rewrite sends it to the not-found page before anything renders, so it
 * answers 404 from its first visit: the page itself, for an address outside
 * `generateStaticParams`, sends the route's prerendered shell with a 200 before its
 * `notFound()` has run. The router reads a source without case, as `isDayId` does; a slug or an
 * id followed by a dot is left to the page, since that is how the build names the files it
 * writes beside a page (`bologna.rsc`, `bologna.segments`).
 */
export function notADaySource(): string {
  const names = [...START_REQUESTS.map(daySlugOf), DAY_ID_PATTERN].join("|");
  return `/day/:address((?!(?:${names})(?:[.]|$))[^/]+)`;
}
