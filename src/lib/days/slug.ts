import type { DayRequest } from "@/lib/schema/itinerary.schema";

// Read by next.config.ts, whose loader does not resolve the `@/` alias: relative imports only,
// type imports aside, which compile away.

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
