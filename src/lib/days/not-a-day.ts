import { DAY_ID_PATTERN } from "./stored-day";
import { daySlugOf } from "./slug";
import { CITY_REQUESTS } from "./written/city-days";
import { START_REQUESTS } from "./written/quick-starts";

// Read by next.config.ts, whose loader does not resolve the `@/` alias: relative imports only,
// type imports aside, which compile away.

/**
 * Every address under `/day` that can name no day, as a route's `source` for the router to
 * match: one segment that is neither a written day's slug, the starts' and the city days'
 * (`WRITTEN_REQUESTS`), nor a day's id. A rewrite sends it to the not-found page before anything renders, so it
 * answers 404 from its first visit: the page itself, for an address outside
 * `generateStaticParams`, sends the route's prerendered shell with a 200 before its
 * `notFound()` has run.
 *
 * Written only in the form Next's docs show for a source, a named parameter whose pattern
 * opens on a negative lookahead (`/:path((?!another-page$).*)`, under "Header, Cookie, and
 * Query Matching" in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md`),
 * with no inline flag, since the host's router compiles the source itself. Case is the
 * router's: Next reads a source without it, so `/day/Bologna` reaches the page as a slug does.
 * A slug or an id followed by a dot is left to the page too, since that is how the build names
 * the files it writes beside a page (`bologna.rsc`, `bologna.segments`).
 */
export function notADaySource(): string {
  const slugs = [...START_REQUESTS, ...CITY_REQUESTS].map(daySlugOf).join("|");
  return `/day/:address((?!(?:${slugs})(?:[.]|$))(?!${DAY_ID_PATTERN}(?:[.]|$))[^/]+)`;
}
