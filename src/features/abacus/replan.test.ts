import { describe, expect, it } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { ENERGY_LEVELS } from "@/lib/schema/itinerary.schema";
import { replanForEnergy } from "./replan";

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
