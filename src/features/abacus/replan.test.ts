import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { ENERGY_LEVELS } from "@/lib/schema/itinerary.schema";
import { modelPicks, shownPlacesOf } from "./curve";
import { replanForEnergy, stopsRepickedOf } from "./replan";

const normalized = normalizeDay(KYOTO_DAY.request, KYOTO_DAY.day);
if (!normalized.ok) throw new Error(normalized.reason);
const { stops } = normalized.itinerary;
const CALM = ENERGY_LEVELS.indexOf("calm");
const LIVELY = ENERGY_LEVELS.indexOf("lively");

describe("replanForEnergy", () => {
  it("leaves the plan alone when the energy word does not change", () => {
    expect(replanForEnergy(stops, CALM, CALM)).toEqual(stops);
  });

  it("moves a livelier word's plan to livelier versions the model already wrote", () => {
    const lively = replanForEnergy(stops, CALM, LIVELY);
    const moved = lively.filter(
      (stop, index) => stop.selectedPlaceId !== stops[index]?.selectedPlaceId,
    );

    expect(moved.length).toBeGreaterThan(0);
    moved.forEach((stop) =>
      expect(stop.alternatives.map(({ id }) => id)).toContain(stop.selectedPlaceId),
    );
  });
});

describe("stopsRepickedOf", () => {
  const planned = shownPlacesOf(stops, modelPicks(stops));

  it("counts the stops whose plan moves, against what each shows", () => {
    const lively = replanForEnergy(stops, CALM, LIVELY);
    const moved = lively.filter(
      (stop, index) => stop.selectedPlaceId !== stops[index]?.selectedPlaceId,
    );

    expect(stopsRepickedOf(planned, lively)).toBe(moved.length);
    expect(stopsRepickedOf(planned, stops)).toBe(0);
  });

  it("counts a stop the visitor swapped when the re-pick takes it back to its plan", () => {
    const [first] = stops;
    if (!first?.alternatives[0]) throw new Error("Kyoto's first stop has a version");
    const swapped = { ...planned, [first.id]: first.alternatives[0].id };

    expect(stopsRepickedOf(swapped, stops)).toBe(1);
  });

  it("leaves out a stop not on screen yet", () => {
    const lively = replanForEnergy(stops, CALM, LIVELY);
    const moved = lively.filter(
      (stop, index) => stop.selectedPlaceId !== stops[index]?.selectedPlaceId,
    );
    const [unseen] = moved;
    if (!unseen) throw new Error("A livelier word moves one of Kyoto's stops");
    const onScreen = Object.fromEntries(Object.entries(planned).filter(([id]) => id !== unseen.id));

    expect(stopsRepickedOf(onScreen, lively)).toBe(moved.length - 1);
  });
});
