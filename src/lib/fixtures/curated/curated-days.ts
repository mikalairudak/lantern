import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { ALICANTE_DAY } from "./alicante";
import type { WrittenDay } from "@/lib/days/written/written-day";
import { KYOTO_DAY } from "./kyoto";
import { LISBON_DAY } from "./lisbon";
import { isSameRequest } from "@/lib/days/request";

/** Every curated day. Kyoto is the hero day the quality thresholds are calibrated on. */
export const CURATED_DAYS: readonly WrittenDay[] = [KYOTO_DAY, ALICANTE_DAY, LISBON_DAY];

/**
 * The curated day written for exactly this request, or null. The whole request has to
 * match, not only the city: the normalizer writes the request's words over the day, so a
 * calm Kyoto day served for a lively request would claim a plan it never made.
 */
export function curatedDayFor(request: DayRequest): WrittenDay | null {
  return CURATED_DAYS.find((curated) => isSameRequest(curated.request, request)) ?? null;
}
