import type { IntakeResult } from "@/lib/schema/intake.schema";
import type { DayRequest } from "@/lib/schema/itinerary.schema";

/**
 * A city the intake resolved, signed by the intake route so the day route can tell it from
 * one a client wrote (`docs/decisions.md`, 2026-10-30, "A day for a city Lantern has not
 * written carries the intake's signature"). Client-safe: the signature is opaque here, and
 * only the server holds the key (`src/lib/live/city-signature.ts`).
 */

/** The header a day request sends its city's signature in, so the body stays a `DayRequest`. */
export const CITY_SIGNATURE_HEADER = "lantern-city-signature";

/**
 * The header a day request names a kept day in, by its id, when it asks for a day in that day's
 * city: the server reads the city and zone from its own record of the day, which a page opened
 * at the day's address holds in place of the intake's signature.
 */
export const KEPT_DAY_HEADER = "lantern-kept-day";

/** The free text of a request the day's model reads: the city, and its zone from the provider. */
export type SignedPart = Pick<DayRequest, "city" | "timezone">;

/** A city and zone as the intake route resolved them, with its signature over the two. */
export interface SignedCity extends SignedPart {
  signature: string;
}

/**
 * What `POST /api/intake` answers: the intake's result and, with live generation, every city
 * it could play signed, the request's own and each reading's. None with live generation off,
 * when only written days play.
 */
export type IntakeRouteAnswer = IntakeResult & { signed?: readonly SignedCity[] };

/** One key per city and zone, for looking a signature up by the request it would sign. */
export function signedKeyOf({ city, timezone }: SignedPart): string {
  return JSON.stringify([city, timezone]);
}
