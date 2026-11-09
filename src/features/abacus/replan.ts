import { MAX_ENERGY, candidatesOf, energyOf, modelPick, pickCandidate } from "./curve";
import { hasEnergy, type StopDraft } from "./day-draft";

function shifted(energy: number, shift: number): number {
  return Math.min(MAX_ENERGY, Math.max(0, energy + shift));
}

/**
 * The day re-planned for a new energy word, locally, from the versions the model already
 * wrote: the curve's rest shifts by the difference between the two words, and each stop
 * takes the version nearest to it as its new plan. The plan moves, not the visitor's
 * picks, so the headline gains no clause. Ties keep the plan.
 */
export function replanForEnergy(
  stops: readonly StopDraft[],
  from: number,
  to: number,
): StopDraft[] {
  return stops.map((stop) => {
    if (!hasEnergy(stop)) return stop;
    const candidates = candidatesOf(stop);
    const planned = modelPick(stop);
    const energies = candidates.map(energyOf);
    const pick = pickCandidate(energies, shifted(energies[planned] ?? 0, to - from), planned);
    const place = candidates[pick];
    return pick === planned || !place ? stop : { ...stop, selectedPlaceId: place.id };
  });
}
