import { describe, expect, it } from "vitest";
import { BOLOGNA_START_DAY } from "@/lib/days/written/bologna";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { shownEnergiesOf } from "./day-shape";

describe("shownEnergiesOf", () => {
  it("reads each stop's energy from the place the day shows, not only the first written", () => {
    const normalized = normalizeDay(BOLOGNA_START_DAY.request, BOLOGNA_START_DAY.day);
    if (!normalized.ok) throw new Error(normalized.reason);
    const { itinerary } = normalized;
    const [first, ...rest] = itinerary.stops;
    const other = first!.alternatives[0]!;
    const swapped = { ...itinerary, stops: [{ ...first!, selectedPlaceId: other.id }, ...rest] };

    expect(shownEnergiesOf(itinerary)[0]).toBe(first!.primary.sensory.energy);
    expect(shownEnergiesOf(swapped)[0]).toBe(other.sensory.energy);
  });
});
