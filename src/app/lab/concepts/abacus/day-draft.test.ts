import { describe, expect, it } from "vitest";
import { GeneratedDaySchema } from "@/lib/schema/itinerary.schema";
import { revealDay, revealLength, type RevealedDay } from "./stand-in-stream";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { DEK, draftDayOf, hasEnergy, isWriting, type DayDraft } from "@/features/abacus/day-draft";
import { generatedDayOf } from "./stream";

const GENERATED = generatedDayOf(ABACUS_DAY);
const TOTAL = revealLength(GENERATED);

function draftAt(budget: number): DayDraft {
  return draftDayOf(revealDay(GENERATED, budget));
}

/** The first budget at which a condition holds, for conditions that stay true once met. */
function firstBudget(condition: (day: DayDraft) => boolean): number {
  let low = 0;
  let high = TOTAL;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (condition(draftAt(middle))) high = middle;
    else low = middle + 1;
  }
  return low;
}

function idsOf(day: DayDraft): string[] {
  return day.stops.flatMap((stop) => [
    stop.id,
    stop.primary.id,
    ...stop.alternatives.map((alternative) => alternative.id),
  ]);
}

describe("generatedDayOf", () => {
  it("produces a day the generation schema accepts", () => {
    expect(GeneratedDaySchema.safeParse(GENERATED).success).toBe(true);
  });

  it("writes one set of alternatives per stop, after all the stops", () => {
    expect(Object.keys(GENERATED)).toEqual(["dek", "stops", "alternatives", "assumptions"]);
    expect(GENERATED.alternatives.map(({ stopIndex }) => stopIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(GENERATED.alternatives[4]?.options.map(({ name }) => name)).toEqual([
      "Arroz a banda by the port",
      "Tapas on San Fernando",
    ]);
  });
});

describe("draftDayOf", () => {
  it("writes the line about the day before any stop", () => {
    const day = draftAt(10);

    expect(day.dek).toBe(GENERATED.dek.slice(0, 10));
    expect(day.writing).toBe(DEK);
    expect(day.stops).toEqual([]);
  });

  it("places a stop once its place has started, after a whole time and duration", () => {
    const placed = firstBudget((day) => day.stops.length > 0);

    expect(revealDay(GENERATED, placed - 1).day.stops?.[0]).toEqual({
      startTime: "07:45",
      durationMinutes: 45,
    });
    expect(draftAt(placed - 1).stops).toEqual([]);
    expect(draftAt(placed).stops).toEqual([
      {
        id: "stop-0",
        startTime: "07:45",
        durationMinutes: 45,
        primary: { id: "stop-0:p", name: "P" },
        alternatives: [],
        selectedPlaceId: "stop-0:p",
        dependsOn: ["energy"],
      },
    ]);
  });

  it("waits out a half-written time or duration, as a real stream can send them", () => {
    const stopsOf = (stop: NonNullable<RevealedDay["day"]["stops"]>[number]) =>
      draftDayOf({ day: { stops: [stop] }, activePath: null, isComplete: false }).stops;

    expect(stopsOf({ startTime: "09:" })).toEqual([]);
    expect(stopsOf({ startTime: "09:30", durationMinutes: 9 })).toEqual([]);
    expect(stopsOf({ startTime: "9:3", durationMinutes: 90, place: { name: "M" } })).toEqual([]);
    expect(stopsOf({ startTime: "09:30", durationMinutes: 90, place: { name: "M" } })).toEqual([
      expect.objectContaining({ id: "stop-0", startTime: "09:30", durationMinutes: 90 }),
    ]);
  });

  it("keeps a stop without energy until its sensory profile is written", () => {
    const named = firstBudget((day) => Boolean(day.stops[2]?.primary.name));
    const energetic = firstBudget((day) => day.stops[2] !== undefined && hasEnergy(day.stops[2]));
    const beforeEnergy = draftAt(energetic - 1).stops[2]!;

    expect(isWriting(draftAt(named).writing, "stop-2:p", "name")).toBe(true);
    expect(beforeEnergy.primary.name).toBe("Castillo de Santa Bárbara");
    expect(beforeEnergy.primary.coordinates).toBeDefined();
    expect(hasEnergy(beforeEnergy)).toBe(false);
    expect(draftAt(energetic).stops[2]?.primary.sensory?.energy).toBe("balanced");
  });

  it("adds alternatives only after every stop, each once its energy is written", () => {
    const firstOption = firstBudget((day) =>
      day.stops.some((stop) => stop.alternatives.length > 0),
    );
    const before = draftAt(firstOption - 1);
    const after = draftAt(firstOption);

    expect(before.stops).toHaveLength(8);
    expect(before.stops.every(hasEnergy)).toBe(true);
    expect(before.stops.at(-1)?.primary.light?.note).toBe(
      ABACUS_DAY.stops.at(-1)?.primary.light.note,
    );
    expect(revealDay(GENERATED, firstOption - 1).day.alternatives?.[0]?.options?.[0]?.name).toBe(
      "Churros in the old town",
    );
    expect(after.stops[0]?.alternatives).toEqual([
      expect.objectContaining({ id: "stop-0:a1", sensory: { energy: "calm" } }),
    ]);
  });

  it("keeps every id from its first appearance to the complete day", () => {
    const finalIds = new Set(idsOf(draftAt(TOTAL)));
    let seen = new Set<string>();

    for (let budget = 0; budget <= TOTAL; budget += 1) {
      const ids = idsOf(draftAt(budget));
      ids.forEach((id) => expect(finalIds).toContain(id));
      seen.forEach((id) => expect(ids).toContain(id));
      seen = new Set(ids);
    }
  });

  it("completes into the itinerary the stream stands for", () => {
    const day = draftAt(TOTAL);

    expect(day.stops).toEqual(ABACUS_DAY.stops);
    expect(day.dek).toBe(ABACUS_DAY.dek);
    expect(day.writing).toBeNull();
    expect(day.isComplete).toBe(true);
  });

  it("names versions by their place in the stop's first set, as the normalizer does", () => {
    const calm = { energy: "calm" } as const;
    const near = { lat: 38.345, lng: -0.481 };
    // About 1.1 km north, past the walk a version may be from its stop: the normalizer drops it.
    const far = { lat: 38.355, lng: -0.481 };
    const revealed: RevealedDay = {
      day: {
        stops: [
          // Weighed: its energy and its best window are written.
          {
            startTime: "10:00",
            durationMinutes: 60,
            place: {
              name: "Mercat",
              coordinates: near,
              sensory: calm,
              light: { bestWindow: "none" },
            },
          },
        ],
        alternatives: [
          {
            stopIndex: 0,
            options: [
              { name: "Cloister", coordinates: near, sensory: { energy: "reflective" } },
              { name: "Chapel", coordinates: far, sensory: { energy: "reflective" } },
              { name: "Twin", coordinates: near, sensory: calm },
              { name: "Half-written" },
            ],
          },
          { stopIndex: 3, options: [{ name: "Nowhere", coordinates: near, sensory: calm }] },
          { stopIndex: 0, options: [{ name: "A second set", coordinates: near, sensory: calm }] },
        ],
      },
      activePath: "alternatives.0.options.3.name",
      isComplete: false,
    };

    const [stop] = draftDayOf(revealed).stops;

    expect(stop?.alternatives.map(({ id }) => id)).toEqual(["stop-0:a1", "stop-0:a3"]);
    expect(draftDayOf(revealed).writing).toBeNull();
  });
});
