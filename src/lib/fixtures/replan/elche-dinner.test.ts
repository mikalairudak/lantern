import { describe, expect, it } from "vitest";
import { mergeReplan } from "@/lib/replan/merge";
import { replanPlanOf } from "@/lib/replan/windows";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_LATE_DINNER,
  ELCHE_LATE_DINNER_UNREPEATED,
  ELCHE_SHOWN_STOPS,
} from "./elche-dinner";

describe("Elche's late dinner re-plan", () => {
  it("rewrites the windows the route read: the lunch, and the evening from 16:30", () => {
    const { itinerary, request, windows } = ELCHE_DINNER_BASIS;

    expect(replanPlanOf(itinerary, request, "dinner")).toEqual({ kind: "targeted", windows });
  });

  it("merges into the day production showed, the coffee on the morning's square dropped", () => {
    const merged = mergeReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER });
    if (!merged.ok) throw new Error(merged.reason);

    expect(merged.itinerary.stops.map(({ id, startTime }) => `${id} ${startTime}`)).toEqual(
      ELCHE_SHOWN_STOPS,
    );
    expect(merged.mergeRepairs).toEqual([
      { kind: "dropped-repeat", path: ["stops", 2], note: "Coffee on Plaça de Baix is kept" },
    ]);
    expect(merged.itinerary.dek).toContain("coffee on the square again");
  });

  it("drops nothing without the coffee", () => {
    const merged = mergeReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
    if (!merged.ok) throw new Error(merged.reason);

    expect(merged.mergeRepairs).toEqual([]);
    expect(merged.itinerary.stops).toHaveLength(ELCHE_SHOWN_STOPS.length);
  });
});
