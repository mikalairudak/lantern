import {
  replanIdPrefix,
  withPicks,
  type ReplanBasisRef,
  type ReplanPicks,
  type ReplanRequest,
} from "@/lib/replan/request";
import type { ReplanBasis } from "@/lib/replan/merge";
import type { WindowSpan } from "@/lib/replan/windows";
import type { AssumableFactKey, DayRequest, Itinerary } from "@/lib/schema/itinerary.schema";
import type { ReplanSource } from "./use-replan-stream";

/** Lantern's own route for a targeted re-plan (`docs/targeted-replan.md`). */
export const REPLAN_ROUTE = "/api/replan";

export interface ReplanAsk {
  /**
   * The day on screen as the model wrote it, each stop's selection the model's, for the
   * page's own frames and merge. The route reads the same day from its own records, by
   * `basis`, never from the page (`docs/security.md`, S1).
   */
  itinerary: Itinerary;
  /**
   * Where the route reads the day: a written day's address, or the id the log keeps it by;
   * null for a day the page holds by neither, which the route cannot re-plan.
   */
  basis: ReplanBasisRef | null;
  /** The request with the changed word. */
  request: DayRequest;
  changed: AssumableFactKey;
  /** The windows the page read for the word (`replanPlanOf`), which the route reads again. */
  windows: readonly WindowSpan[];
  /** The page's count of re-plans of this day, from 1: the new ids start with it. */
  round: number;
  /**
   * The places the visitor chose over the day's plan, by stop id: the route reads its day with
   * them planned, so the new stops fit around, and the new line names, what is on screen.
   */
  picks: ReplanPicks;
}

/**
 * What the page holds before a re-plan streams, for its frames and its merge: the day as the
 * route reads it, its picked stops planned on the visitor's places (`withPicks`), so the day the
 * page merges is the one the server keeps.
 */
export function replanBasisOf({
  itinerary,
  request,
  changed,
  windows,
  round,
  picks,
}: ReplanAsk): ReplanBasis {
  return {
    itinerary: withPicks(itinerary, picks),
    request,
    changed,
    windows,
    idPrefix: replanIdPrefix(round),
  };
}

/**
 * A targeted re-plan streamed from the route, for `useReplanStream().play`. The body names
 * the day and carries the request of enums, the word, the count and the picks by id: no day and
 * no signature, since the route reads the day, and its city, from its own records. Null for a
 * day with no basis, which the page then re-plans whole.
 */
export function replanRouteSourceFor(ask: ReplanAsk): ReplanSource | null {
  if (ask.basis === null) return null;
  const body: ReplanRequest = {
    basis: ask.basis,
    request: ask.request,
    changed: ask.changed,
    round: ask.round,
    picks: ask.picks,
  };
  return {
    basis: replanBasisOf(ask),
    open: (signal) =>
      fetch(REPLAN_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
  };
}
