import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BOLOGNA_START_DAY } from "@/lib/days/written/bologna";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { EnergyLevel } from "@/lib/schema/itinerary.schema";
import {
  DAY_SHAPE,
  DayShape,
  shapeCurveOf,
  shapeHeightOf,
  shapePointsOf,
  shownEnergiesOf,
} from "./day-shape";

const QUIET_TO_LOUD: EnergyLevel[] = ["reflective", "calm", "balanced", "lively", "social"];

describe("the shape of a day", () => {
  it("sets each stop in its energy's lane, one step down from the stop before", () => {
    const points = shapePointsOf(QUIET_TO_LOUD);

    expect(points.map(({ x }) => x)).toEqual([5, 16, 27, 38, 49]);
    expect(points.map(({ y }) => y)).toEqual([10, 20, 30, 40, 50]);
    // The social lane stands inside the shape, its bead whole.
    expect(points.at(-1)!.x + DAY_SHAPE.beadRadius).toBeLessThanOrEqual(DAY_SHAPE.width);
  });

  it("draws the curve through every bead, leaving and reaching each straight down", () => {
    expect(shapeCurveOf(shapePointsOf(["calm", "lively"]))).toBe("M16 10 C16 15 38 15 38 20");
    expect(shapeCurveOf(shapePointsOf(["calm"]))).toBe("M16 10");
    expect(shapeCurveOf([])).toBe("");
  });

  it("grows with the day, holding the same room above its first stop and below its last", () => {
    expect(shapeHeightOf(8)).toBe(90);
    expect(shapeHeightOf(1)).toBe(20);
    expect(shapeHeightOf(0)).toBe(20);
  });

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

  it("is drawn unheard, a bead for each stop", () => {
    const { container } = render(<DayShape energies={QUIET_TO_LOUD} />);
    const shape = container.querySelector("svg");

    expect(shape).toHaveAttribute("aria-hidden");
    expect(shape).toHaveAttribute("height", "60");
    expect(shape?.querySelectorAll("circle")).toHaveLength(5);
  });
});
