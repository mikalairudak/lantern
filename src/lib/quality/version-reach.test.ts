// @vitest-environment node
import { describe, expect, it } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { addReach, NO_REACH, reachOfOutput, reachRow, versionReachOf } from "./version-reach";

function kanazawa(): Itinerary {
  const normalized = normalizeDay(KANAZAWA_START_DAY.request, KANAZAWA_START_DAY.day);
  if (!normalized.ok) throw new Error(normalized.reason);
  return normalized.itinerary;
}

describe("versionReachOf", () => {
  it("counts the versions a day keeps, the stops with none, and the moves a version answers", () => {
    // Kanazawa's start keeps 11 versions of its 15: four stood past the walk (`day-draft.test.ts`).
    // Its first stop is reflective, so it asks one move, livelier, and its one version is as
    // reflective, which answers none. The other seven ask two each: the four that lost a version
    // to the walk answer one, the three that kept both answer two. 1 + 14 = 15 moves; 0 + 4 + 6
    // = 10 answered.
    const reach = versionReachOf(kanazawa());

    expect(reach).toMatchObject({ days: 1, stops: 8, versions: 11, bareStops: 0 });
    expect(reach.moves).toBe(15);
    expect(reach.reachable).toBe(10);
  });

  it("answers no move at a stop whose versions are all gone", () => {
    const itinerary = kanazawa();
    const bare = {
      ...itinerary,
      stops: itinerary.stops.map((stop) => ({ ...stop, alternatives: [] })),
    };

    expect(versionReachOf(bare)).toMatchObject({
      versions: 0,
      bareStops: 8,
      reachable: 0,
      moves: 15,
    });
  });

  it("adds days up, and reads a recorded day from its text, or nothing from text that is no day", () => {
    const fromText = reachOfOutput(
      KANAZAWA_START_DAY.request,
      JSON.stringify(KANAZAWA_START_DAY.day),
    );

    expect(fromText).toEqual(versionReachOf(kanazawa()));
    expect(addReach(fromText!, fromText!)).toMatchObject({ days: 2, versions: 22, moves: 30 });
    expect(reachOfOutput(KANAZAWA_START_DAY.request, '{"stops": [')).toBeNull();
    expect(reachOfOutput(KANAZAWA_START_DAY.request, '{"stops": []}')).toBeNull();
  });

  it("is a report's row: days, versions a day, stops with none and moves with a version", () => {
    expect(reachRow("days", versionReachOf(kanazawa()))).toEqual([
      "days",
      "1",
      "11.0",
      "0 of 8 (0%)",
      "10 of 15 (67%)",
    ]);
    expect(reachRow("shadows", NO_REACH)).toEqual(["shadows", "0", "–", "–", "–"]);
  });
});
