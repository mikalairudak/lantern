import { describe, expect, it } from "vitest";
import { checkReplanWindows, checkReplanWord } from "@/lib/quality/replan-checks";
import { mergeReplan } from "@/lib/replan/merge";
import { replanPlanOf } from "@/lib/replan/windows";
import { KYOTO_EVENING_BASIS, KYOTO_LATE_EVENING, KYOTO_OUT_LATE } from "./kyoto-evening";
import { KYOTO_ITINERARY } from "./kyoto-morning";

describe("the late evening's re-plan", () => {
  it("rewrites the window the page reads for out late: the last stop alone", () => {
    expect(replanPlanOf(KYOTO_ITINERARY, KYOTO_OUT_LATE, "end")).toMatchObject({
      windows: KYOTO_EVENING_BASIS.windows,
    });
  });

  it("is a re-plan the route would keep: inside its window, and out late", () => {
    expect(checkReplanWindows(KYOTO_EVENING_BASIS, KYOTO_LATE_EVENING).findings).toEqual([]);
    expect(checkReplanWord(KYOTO_EVENING_BASIS, KYOTO_LATE_EVENING).findings).toEqual([]);
  });

  it("ends the day with a new last stop, at midnight, past the old end", () => {
    const merged = mergeReplan({ ...KYOTO_EVENING_BASIS, replan: KYOTO_LATE_EVENING });
    if (!merged.ok) throw new Error(merged.reason);
    const last = merged.itinerary.stops.at(-1);

    expect(last?.primary.name).toBe("Bars along the Takase canal");
    expect(merged.itinerary.stops).toHaveLength(KYOTO_ITINERARY.stops.length + 1);
  });
});
