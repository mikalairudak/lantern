import { toGeneratedOption } from "@/lib/normalizer/generated-day";
import type { GeneratedDay, Itinerary } from "@/lib/schema/itinerary.schema";
import { toGeneratedDay } from "./stand-in-stream";

// The lab's stand-ins read the app's own writing-back of a day, from where the eval reads it.
export { toGeneratedOption, toGeneratedPlace } from "@/lib/normalizer/generated-day";

/**
 * The generation-layer day the abacus fixture stands for: the stand-in stream's stops,
 * then one set of alternatives per stop, written after all of them as the schema orders
 * it. Revealed with the stand-in's `revealDay`, it streams the plan first and the
 * options last.
 */
export function generatedDayOf(itinerary: Itinerary): GeneratedDay {
  return {
    ...toGeneratedDay(itinerary),
    alternatives: itinerary.stops.map((stop, stopIndex) => ({
      stopIndex,
      options: stop.alternatives.map(toGeneratedOption),
    })),
  };
}
