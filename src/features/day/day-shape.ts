import type { EnergyLevel, Itinerary } from "@/lib/schema/itinerary.schema";

/** The energy of each stop's place as the day shows it, in the day's order. */
export function shownEnergiesOf(itinerary: Pick<Itinerary, "stops">): EnergyLevel[] {
  return itinerary.stops.map((stop) => {
    const shown = [stop.primary, ...stop.alternatives].find(
      (place) => place.id === stop.selectedPlaceId,
    );
    return (shown ?? stop.primary).sensory.energy;
  });
}
