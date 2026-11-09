import { dayAddressOf, START_ADDRESS } from "@/lib/days/address";
import type { DayRequest, EnergyLevel } from "@/lib/schema/itinerary.schema";
import { SITE_NAME } from "@/lib/site";
import { requestSentenceOf } from "./sentence";

/** A page's tab title as the root layout's template writes it: its name, then the site's. */
export function pageTitleOf(name: string): string {
  return `${name} · ${SITE_NAME}`;
}

/**
 * The tab's title for the day on screen: its sentence, as its address's page is titled,
 * with the energy the visitor re-picked on it, so the tab and the headline say the same.
 * A day at the start screen's address, which has none of its own, is titled as Lantern. Its
 * address is a written day's own unless said: a day of the visitor's has its id's.
 */
export function dayTitleOf(
  request: DayRequest | null,
  energy?: EnergyLevel,
  address: string = dayAddressOf(request),
): string {
  if (request === null || address === START_ADDRESS) return SITE_NAME;
  return `${requestSentenceOf({ ...request, energy: energy ?? request.energy })} · ${SITE_NAME}`;
}
