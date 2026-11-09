import { describe, expect, it } from "vitest";
import { GeneratedDaySchema } from "@/lib/schema/itinerary.schema";
import { ALICANTE_SKETCH } from "@/lib/fixtures/hand-made/alicante-sketch";
import { revealDay, revealLength, toGeneratedDay } from "./stand-in-stream";

const day = toGeneratedDay(ALICANTE_SKETCH);

describe("toGeneratedDay", () => {
  it("produces a day the generation schema accepts", () => {
    expect(GeneratedDaySchema.safeParse(day).success).toBe(true);
  });
});

describe("revealDay", () => {
  it("shows nothing before the stream starts", () => {
    expect(revealDay(day, 0)).toEqual({ day: {}, activePath: null, isComplete: false });
  });

  it("writes the line about the day character by character", () => {
    const { day: partial, activePath } = revealDay(day, 5);

    expect(partial.dek).toBe(day.dek.slice(0, 5));
    expect(partial.stops).toBeUndefined();
    expect(activePath).toBe("dek");
  });

  it("places a stop's times before any of its place arrives", () => {
    const budget = day.dek.length + 8;
    const { day: partial } = revealDay(day, budget);

    expect(partial.stops?.[0]).toEqual({ startTime: "07:45", durationMinutes: 45 });
  });

  it("never shows half an enum value", () => {
    const lengths = Array.from({ length: revealLength(day) }, (_, budget) => budget);
    const energies = lengths.map((budget) => revealDay(day, budget).day.stops?.[0]?.place?.sensory);

    for (const sensory of energies) {
      if (sensory?.energy !== undefined) expect(sensory.energy).toBe("reflective");
    }
  });

  it("returns the whole day once the budget covers it", () => {
    const revealed = revealDay(day, revealLength(day));

    expect(revealed.day).toEqual(day);
    expect(revealed.isComplete).toBe(true);
    expect(revealed.activePath).toBeNull();
  });
});
