import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { isWrittenRequest } from "./written/requests";

/** The start screen's address, which is also where a day with no address of its own is. */
export const START_ADDRESS = "/";

/**
 * A day of the visitor's address, by its id in the log: a link to it opens the day for
 * 30 days, for anyone who has it (`docs/decisions.md`, "A day is written to its end, and kept to be
 * opened again").
 */
export function dayAddressOfId(id: string): string {
  return `/day/${id}`;
}

/**
 * A written day's address under `/day`, which a visitor can send as a link: its city as a
 * URL says it, lowercased, its accents dropped and anything else between words a hyphen
 * ("São Paulo" is "sao-paulo"). Lantern writes one day per city, so the city names the day.
 */
export function daySlugOf(request: Pick<DayRequest, "city">): string {
  return request.city
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The address of the day on screen: a written day's own, so a copied link opens that day.
 * While the start screen shows, with no day (null), and for any day Lantern has not written
 * word for word, it is the start screen's, since no other address would open what is on
 * screen.
 */
export function dayAddressOf(request: DayRequest | null): string {
  if (request === null || !isWrittenRequest(request)) return START_ADDRESS;
  return `/day/${daySlugOf(request)}`;
}
