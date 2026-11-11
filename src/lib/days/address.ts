import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { daySlugOf } from "./slug";
import { isWrittenRequest } from "./written/requests";

export { daySlugOf };

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
 * The address of the day on screen: a written day's own, so a copied link opens that day.
 * While the start screen shows, with no day (null), and for any day Lantern has not written
 * word for word, it is the start screen's, since no other address would open what is on
 * screen.
 */
export function dayAddressOf(request: DayRequest | null): string {
  if (request === null || !isWrittenRequest(request)) return START_ADDRESS;
  return `/day/${daySlugOf(request)}`;
}
