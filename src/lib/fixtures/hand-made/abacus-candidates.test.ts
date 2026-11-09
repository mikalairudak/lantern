import { describe, expect, it } from "vitest";
import { ItinerarySchema } from "@/lib/schema/itinerary.schema";
import { ABACUS_DAY } from "./abacus-candidates";
import { MAX_ENERGY, candidatesOf, energyOf } from "@/features/abacus/curve";

describe("the Alicante day with candidates", () => {
  it("satisfies every app-layer invariant", () => {
    const result = ItinerarySchema.safeParse(ABACUS_DAY);

    expect(result.error?.issues ?? []).toEqual([]);
  });

  it("gives every stop a quieter and a livelier version where the scale allows", () => {
    ABACUS_DAY.stops.forEach((stop) => {
      const primary = energyOf(stop.primary);
      const versions = stop.alternatives.map((place) =>
        energyOf(place) < primary ? "quieter" : energyOf(place) > primary ? "livelier" : "same",
      );
      const expected = [
        ...(primary > 0 ? ["quieter"] : []),
        ...(primary < MAX_ENERGY ? ["livelier"] : []),
      ];

      expect(versions).toEqual(expected);
      expect(stop.alternatives.map(({ id }) => id)).toEqual(
        expected.map((_, n) => `${stop.id}:a${n + 1}`),
      );
    });
  });

  it("keeps candidate energies distinct, so the curve can tell them apart", () => {
    ABACUS_DAY.stops.forEach((stop) => {
      const energies = candidatesOf(stop).map(energyOf);

      expect(new Set(energies).size).toBe(energies.length);
    });
  });
});
