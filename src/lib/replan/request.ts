import { z } from "zod";
import { isDayId } from "@/lib/days/stored-day";
import {
  AssumableFactKeySchema,
  DayRequestSchema,
  type DayRequest,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";

/**
 * What the page sends `POST /api/replan` (`docs/targeted-replan.md`, sections 2 and 5): which
 * day it re-plans, the request with the changed word, which word changed, and its count of
 * re-plans. The day itself is the server's: a written day's from its file, a live day's or an
 * earlier re-plan's from the log, never the client's, so no text a client wrote reaches the
 * model or is kept to be shown at the re-plan's link (`docs/security.md`, S1; `docs/decisions.md`,
 * "A re-plan reads its day from the server's own records"). Until then the page sent its day.
 * The request is the
 * page's because only the page knows the visitor's words: one of Lantern's taken as it is, or
 * an energy picked again on the day, changes no day on the server. Its words are enums; its
 * city, date and zone must be the day's. Only the page knows the visitor's picks too, so it
 * sends them, as ids alone, each one of the server's own day's stops and that stop's own places
 * (`picksIssueOf`); the kept stops are read as the visitor sees them, and the new line about the
 * day is written around those places (`docs/decisions.md`, "A re-plan reads its day from the
 * server's own records").
 */

/** A page re-plans its day this many times at most; past it, the page asks for a new day. */
export const MAX_REPLAN_ROUND = 50;

/**
 * More than any of 140 recorded live days held (eleven), and few enough to bound the prompt,
 * whose size the re-plan's reservation is held at (`REPLAN_INPUT_TOKENS_CEILING`).
 */
export const MAX_REPLAN_STOPS = 16;

/** A place's name or neighbourhood as the re-plan reads it: over twice the recorded days' longest, 52. */
export const MAX_KEPT_TEXT_CHARS = 120;

/**
 * What `POST /api/replan` answers when the word re-plans the whole day, with its reason: the
 * page then asks `POST /api/day` for a new day.
 */
export const REPLAN_WHOLE_DAY_STATUS = 409;

/**
 * The body: a day's reference, a request of enums, a word, a count and a pick for each stop at
 * most, under 2 KB. Sixteen picks of the longest ids take about 1.1 KB.
 */
export const MAX_REPLAN_BODY_BYTES = 2048;

/** Longer than any id a day of `MAX_REPLAN_ROUND` re-plans holds, `r50-stop-15:a2`. */
const MAX_ID_CHARS = 32;
/** A stop's or a place's id as the normalizer and the merge write them (`positions.ts`). */
const DAY_ITEM_ID = /^[a-z0-9]+(?:[-:][a-z0-9]+)*$/;
const DayItemIdSchema = z.string().max(MAX_ID_CHARS).regex(DAY_ITEM_ID, "A stop's or a place's id");

/**
 * The places the visitor chose over the day's plan, by stop id: the version each stop shows
 * where it is not the one its `selectedPlaceId` plans. Ids alone, never a place's words.
 */
export const ReplanPicksSchema = z
  .record(DayItemIdSchema, DayItemIdSchema)
  .refine((picks) => Object.keys(picks).length <= MAX_REPLAN_STOPS, {
    message: `A pick for each stop at most, ${MAX_REPLAN_STOPS}`,
  });

export type ReplanPicks = z.infer<typeof ReplanPicksSchema>;

/** A written day's address, as `daySlugOf` writes it: `kyoto`, `sao-paulo`. */
const DAY_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_DAY_SLUG_CHARS = 100;

/** The ids a re-plan numbered `round` gives its new stops and places start with this. */
export function replanIdPrefix(round: number): string {
  return `r${round}`;
}

/**
 * The day a re-plan rewrites, as the page names it: a written day by its address, or a day
 * the log keeps (a live day, or an earlier re-plan's merged day) by the id its answer named.
 */
export const ReplanBasisRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("written"),
    slug: z.string().max(MAX_DAY_SLUG_CHARS).regex(DAY_SLUG, "A written day's address"),
  }),
  z.strictObject({
    kind: z.literal("kept"),
    id: z.string().refine(isDayId, "A kept day's id"),
  }),
]);

export type ReplanBasisRef = z.infer<typeof ReplanBasisRefSchema>;

export const ReplanRequestSchema = z
  .strictObject({
    basis: ReplanBasisRefSchema,
    request: DayRequestSchema,
    changed: AssumableFactKeySchema,
    round: z.number().int().min(1).max(MAX_REPLAN_ROUND),
    // A page that sends no picks has its day read as planned.
    picks: ReplanPicksSchema.default({}),
  })
  .superRefine(({ request, changed }, ctx) => {
    // The merge makes the changed word the visitor's, and only an asked word has no value.
    if (request[changed] === null) {
      ctx.addIssue({
        code: "custom",
        message: "The changed word needs a value",
        path: ["request", changed],
      });
    }
  });

export type ReplanRequest = z.infer<typeof ReplanRequestSchema>;

/**
 * Why the page's request cannot re-plan the server's day, or null when it can: it names
 * another city, date or zone than the day was written for. The city is the one free text a
 * request carries, so the day's own, checked when the day was written, is the only one taken.
 */
export function requestMismatchOf(request: DayRequest, dayRequest: DayRequest): string | null {
  const differs = (["city", "date", "timezone"] as const).filter(
    (key) => request[key] !== dayRequest[key],
  );
  return differs.length === 0
    ? null
    : `The request must be the day's: the same city, date and time zone (${differs.join(", ")})`;
}

/**
 * Why the server's day is past what a re-plan's prompt may carry, or null when it is within
 * it: more stops than `MAX_REPLAN_STOPS`, or a name or neighbourhood past
 * `MAX_KEPT_TEXT_CHARS`. A day the model wrote stays well inside both; the bound keeps the
 * reservation's worst case true.
 */
export function replanBoundsIssueOf(itinerary: Itinerary): string | null {
  if (itinerary.stops.length > MAX_REPLAN_STOPS) {
    return `A day re-planned holds at most ${MAX_REPLAN_STOPS} stops`;
  }
  const places = itinerary.stops.flatMap((stop) => [stop.primary, ...stop.alternatives]);
  const isPastBound = places.some(
    (place) =>
      place.name.length > MAX_KEPT_TEXT_CHARS || place.neighborhood.length > MAX_KEPT_TEXT_CHARS,
  );
  return isPastBound
    ? `A place's name or neighbourhood is at most ${MAX_KEPT_TEXT_CHARS} characters`
    : null;
}

/**
 * The places a page shows that its day does not plan, by stop id: the picks it sends. A stop
 * showing its plan sends nothing, so a day as planned sends none.
 */
export function picksOf(
  itinerary: Itinerary,
  shown: Readonly<Record<string, string>>,
): ReplanPicks {
  return Object.fromEntries(
    itinerary.stops.flatMap((stop) => {
      const place = shown[stop.id];
      return place === undefined || place === stop.selectedPlaceId ? [] : [[stop.id, place]];
    }),
  );
}

/**
 * Why the page's picks cannot be read against the server's day, or null when they can: a stop
 * the day does not hold, or a place that is not one of that stop's own, the primary or one of
 * its options. Only ids the server's own record holds are ever read.
 */
export function picksIssueOf(itinerary: Itinerary, picks: ReplanPicks): string | null {
  const stops = new Map(itinerary.stops.map((stop) => [stop.id, stop]));
  for (const [stopId, placeId] of Object.entries(picks)) {
    const stop = stops.get(stopId);
    if (stop === undefined) return `The day holds no stop ${stopId}`;
    const places = [stop.primary, ...stop.alternatives];
    if (!places.some(({ id }) => id === placeId)) {
      return `${placeId} is not one of ${stopId}'s places`;
    }
  }
  return null;
}

/**
 * The day as the visitor sees it: each picked stop planned on the place they chose. The places
 * are the day's own, unchanged; only which one each stop plans moves, as a changed energy word
 * moves it (`docs/decisions.md`, "Swaps change selection, not data"). Picks must have passed
 * `picksIssueOf`; one that names nothing of the day changes nothing.
 */
export function withPicks(itinerary: Itinerary, picks: ReplanPicks): Itinerary {
  if (Object.keys(picks).length === 0) return itinerary;
  return {
    ...itinerary,
    stops: itinerary.stops.map((stop) => {
      const pick = picks[stop.id];
      const isOwn =
        pick !== undefined && [stop.primary, ...stop.alternatives].some(({ id }) => id === pick);
      return isOwn && pick !== stop.selectedPlaceId ? { ...stop, selectedPlaceId: pick } : stop;
    }),
  };
}
