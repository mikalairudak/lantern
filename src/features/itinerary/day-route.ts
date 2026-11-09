import { isWrittenRequest } from "@/lib/days/written/requests";
import { SEEN_DAY_HEADER } from "@/lib/days/written/version";
import { CITY_SIGNATURE_HEADER, KEPT_DAY_HEADER } from "@/lib/intake/signed-city";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { DaySource } from "./use-day-stream";

/** Lantern's own route for a day: it streams the written days, and with live generation Claude's. */
export const DAY_ROUTE = "/api/day";

const HTTP_SERVICE_UNAVAILABLE = 503;

/** How the route is asked for a day. */
export interface RouteOptions {
  /** Live generation is on, read on the server for the page: the route answers every request. */
  isLive: boolean;
  /**
   * The intake's signature of the request's city and zone, which the route asks of a city
   * Lantern has not written (`docs/decisions.md`, "A day for a city Lantern has not written carries
   * the intake's signature"); null for a written day's city.
   */
  signature: string | null;
  /**
   * A written day this browser has watched to its end, by its slug and the version it saw
   * (`seen-days.ts`): the route plays that version whole at once. Null for any other day.
   */
  seenKey?: string | null;
  /**
   * The id of the kept day the page opened at its address, whose city the route reads from its
   * own record in place of a signature, so a word changed there writes the day again in its
   * city. Null on any other page.
   */
  keptId?: string | null;
}

const LIVE_GENERATION_OFF: RouteOptions = { isLive: false, signature: null };

/**
 * A day the client knows the route's answer for before asking it, answered here as the route
 * would answer it, without a request the browser would log as a failed resource: the hook
 * reads 429 as `limited` and any other status as `unavailable`.
 */
export function answeredSourceFor(request: DayRequest, status: number): DaySource {
  return { request, open: () => Promise.resolve(new Response(null, { status })) };
}

/**
 * A day streamed from the route, for `useDayStream().play`. With live generation on, every
 * request goes to the route, with its city's signature when it has one, or the kept day it was
 * changed on (`keptId`). With live generation off the route answers only the written days, so
 * any other is answered here as the route would answer it, a 503.
 */
export function routeSourceFor(
  request: DayRequest,
  { isLive, signature, seenKey = null, keptId = null }: RouteOptions = LIVE_GENERATION_OFF,
): DaySource {
  if (!isLive && !isWrittenRequest(request)) {
    return answeredSourceFor(request, HTTP_SERVICE_UNAVAILABLE);
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature !== null) headers[CITY_SIGNATURE_HEADER] = signature;
  if (seenKey !== null) headers[SEEN_DAY_HEADER] = seenKey;
  if (keptId !== null) headers[KEPT_DAY_HEADER] = keptId;
  return {
    request,
    open: (signal) =>
      fetch(DAY_ROUTE, { method: "POST", headers, body: JSON.stringify(request), signal }),
  };
}
