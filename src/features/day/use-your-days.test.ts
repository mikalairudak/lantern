import { describe, expect, it } from "vitest";
import type { PartialDay } from "@/lib/stream/outcome";
import { energiesOfDay, energiesSoFarOf } from "./use-your-days";

/** A day as it streams: each stop's energy as far as it has come. */
function streamedTo(...energies: (string | undefined)[]): PartialDay {
  return {
    stops: energies.map((energy) => ({ place: { sensory: { energy } } })),
  } as PartialDay;
}

describe("the energies a day shows in the visitor's days while it is written", () => {
  it("takes each stop's energy once it has arrived whole", () => {
    expect(energiesSoFarOf(streamedTo("calm", "lively"))).toEqual(["calm", "lively"]);
  });

  it("takes none from a stop whose energy is mid-word or not there yet", () => {
    expect(energiesSoFarOf(streamedTo("calm", "liv"))).toEqual(["calm"]);
    expect(energiesSoFarOf(streamedTo("calm", "", undefined))).toEqual(["calm"]);
    expect(energiesSoFarOf(null)).toEqual([]);
  });

  it("shows a day still written by the stops so far", () => {
    expect(energiesOfDay(streamedTo("balanced", "so"), null)).toEqual(["balanced"]);
  });
});
