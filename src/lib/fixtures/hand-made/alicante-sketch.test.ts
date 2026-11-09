import { describe, expect, it } from "vitest";
import { ItinerarySchema } from "@/lib/schema/itinerary.schema";
import { ALICANTE_SKETCH } from "./alicante-sketch";

describe("the Alicante fixture", () => {
  it("satisfies every app-layer invariant", () => {
    const result = ItinerarySchema.safeParse(ALICANTE_SKETCH);

    expect(result.error?.issues ?? []).toEqual([]);
  });

  it("covers every energy level, so every column of the chart is used", () => {
    const energies = new Set(ALICANTE_SKETCH.stops.map((stop) => stop.primary.sensory.energy));

    expect(energies.size).toBe(5);
  });
});
