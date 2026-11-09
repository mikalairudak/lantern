import { normalizedDayOf, WRITTEN_DAYS } from "@/lib/days/written/days";
import type { WrittenGist } from "./day";
import { shownEnergiesOf } from "./day-shape";

/**
 * The days Lantern has written, the quick starts', as the start screen needs them. A page
 * calls it on the server, so the client gets each day's words and shape without the
 * normalizer or the days themselves.
 */
export function writtenPool(): WrittenGist[] {
  return WRITTEN_DAYS.map((written) => {
    const { request, itinerary } = normalizedDayOf(written);
    return { request, facts: itinerary.facts, energies: shownEnergiesOf(itinerary) };
  });
}
