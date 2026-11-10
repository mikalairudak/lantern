import type { DayRequest, Itinerary } from "@/lib/schema/itinerary.schema";
import type { PlaceCheck } from "@/lib/stream/place-checks";

/**
 * A day kept to be opened again (`docs/decisions.md`, "A day is written to its end, and kept to be
 * opened again"): a live day or re-plan is written to its end and lies in the generation log under
 * an id its answer names, the visitor's own list of their days lives in their browser, and `GET
 * /api/day/<id>` opens one for 30 days. No key of the visitor's is kept on the server. Loadable in
 * a browser: the page reads the header and the answer's shape from here.
 */

/** The header a live day's or a re-plan's answer names its row in the log by. */
export const DAY_ID_HEADER = "X-Lantern-Day";

/** How long a day's link opens it, counted from when it was written. */
export const DAY_LINK_DAYS = 30;

/**
 * A day's id as a pattern, unanchored, for a route's rule to hold too: a UUID in either case,
 * spelled out, so it reads the same whatever flags its reader adds.
 */
export const DAY_ID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const DAY_ID = new RegExp(`^${DAY_ID_PATTERN}$`);

/** Whether a string can be a day's id, a UUID as the server makes them. */
export function isDayId(value: string): boolean {
  return DAY_ID.test(value);
}

/** A day as the log keeps it, with what the page needs to show it whole. */
export interface KeptDay {
  request: DayRequest;
  /** The day as the visitor was shown it, each place confirmed by name at the provider's point. */
  itinerary: Itinerary;
  /**
   * Each place's last check, by its id in `itinerary`. A re-plan's carries its own new places'
   * and the kept places' from the days it was made from, as the page held them when it merged.
   */
  checks: Record<string, PlaceCheck>;
  /** When the day was written, as ISO 8601. */
  writtenAt: string;
  /** How long it took to write, from the call to its last word. */
  seconds: number;
  /**
   * How many re-plans the day has taken: 0 for a live day, its round for a re-plan's, so the
   * next re-plan of it is this plus one, which the route requires.
   */
  round: number;
}

/**
 * What `GET /api/day/<id>` answers, always with a 200:
 *
 * - `written`: the day as it finished;
 * - `cut`: a day whose stream was cut, with the stops the salvage rule kept;
 * - `failed`: the call ended with no day to show, only what was asked;
 * - `unknown`: no such day, or one still being written, whose row lands as its stream ends;
 * - `expired`: written more than `DAY_LINK_DAYS` days ago, with what was asked.
 */
export type StoredDay =
  | ({ status: "written" } & KeptDay)
  | ({ status: "cut" } & KeptDay)
  | { status: "failed"; request: DayRequest }
  | { status: "unknown" }
  | { status: "expired"; request: DayRequest };
