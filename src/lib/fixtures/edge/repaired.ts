import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import type { GeneratedDay } from "@/lib/schema/itinerary.schema";
import type { EdgeDay } from "./edge-day";

// Roughly 2.2 km of latitude: far outside a ten-minute swap walk.
const FAR_LATITUDE_STEP = 0.02;

function slip<T>(items: T[], index: number, change: (item: T) => void): void {
  const item = items[index];
  if (item === undefined) throw new Error(`The Lisbon day has nothing at index ${index}`);
  change(item);
}

/** The curated Lisbon day as a model might slip on it, one slip per kind of repair. */
function withSlips(curated: GeneratedDay): GeneratedDay {
  const day = structuredClone(curated);
  // The visitor said "with friends"; the visitor's word stands.
  day.assumptions.company = "partner";
  slip(day.stops, 0, (stop) => (stop.startTime = "9:45"));
  slip(day.stops, 1, (stop) => (stop.place.name = `${stop.place.name} `));
  // Runs past the Carmo's three o'clock start, so it is cut short there.
  slip(day.stops, 2, (stop) => (stop.durationMinutes = 150));
  slip(day.stops, 4, (stop) => stop.place.aesthetic.push("sunset crowd"));
  // Starts with the stop before it, so it is dropped and leaves a gap in the ids.
  slip(day.stops, 5, (stop) => (stop.startTime = "16:25"));
  slip(day.stops, 6, (stop) => {
    stop.durationMinutes = 120.5;
    stop.dependsOn.push("dinner");
  });
  slip(day.stops, 7, (stop) => (stop.durationMinutes = 600));
  slip(day.alternatives, 1, (set) => set.options.reverse());
  slip(day.alternatives, 3, (set) =>
    slip(set.options, 1, (option) => (option.coordinates.lat += FAR_LATITUDE_STEP)),
  );
  slip(day.alternatives, 7, (set) => day.alternatives.push({ ...set, stopIndex: 8 }));
  return day;
}

/**
 * A finished day the normalizer has to repair: every kind of repair once, so the day it
 * returns differs from the last partial the stream showed. A stop goes, one runs short,
 * an option goes and a pair swaps places at the moment the stream completes.
 */
export const REPAIRED_DAY: EdgeDay = {
  edge: "slips the normalizer repairs, one of each kind",
  request: LISBON_DAY.request,
  day: withSlips(LISBON_DAY.day),
};
