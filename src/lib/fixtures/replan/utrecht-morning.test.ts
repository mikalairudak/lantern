import { describe, expect, it } from "vitest";
import { mergeShownReplan } from "@/lib/replan/merge";
import { replanPlanOf } from "@/lib/replan/windows";
import { GeneratedReplanSchema } from "@/lib/schema/replan.schema";
import { windowsOf } from "@/features/abacus/replan-frame";
import { forkReceiptOf } from "@/features/day/part-slip-lines";
import { UTRECHT_EARLY_MORNING, UTRECHT_MORNING_BASIS } from "./utrecht-morning";

describe("Utrecht's morning made early", () => {
  it("is a re-plan the schema allows", () => {
    expect(GeneratedReplanSchema.parse(UTRECHT_EARLY_MORNING)).toEqual(UTRECHT_EARLY_MORNING);
  });

  it("rewrites the window the route reads for the start: the coffee and the tower", () => {
    const { itinerary, request, windows } = UTRECHT_MORNING_BASIS;

    expect(replanPlanOf(itinerary, request, "start")).toEqual({ kind: "targeted", windows });
  });

  it("merges whole: the coffee and the tower earlier, the park new, the day after as before", () => {
    const merged = mergeShownReplan({ ...UTRECHT_MORNING_BASIS, replan: UTRECHT_EARLY_MORNING });
    if (!merged.ok) throw new Error(merged.reason);

    expect(
      merged.itinerary.stops.map(({ startTime, primary }) => `${startTime} ${primary.name}`),
    ).toEqual([
      "07:30 Coffee on the Oudegracht",
      "08:30 Domtoren",
      "10:00 Park Lepelenburg",
      "12:45 Pancakes on the Domplein",
      "14:15 Centraal Museum",
      "17:30 Dinner on the Wijk C streets",
      "19:15 Oudegracht Canal Walk",
    ]);
  });

  it("is received as one new stop and two earlier", () => {
    const merged = mergeShownReplan({ ...UTRECHT_MORNING_BASIS, replan: UTRECHT_EARLY_MORNING });
    if (!merged.ok) throw new Error(merged.reason);
    const { itinerary, windows } = UTRECHT_MORNING_BASIS;

    expect(
      forkReceiptOf({
        change: { word: "start", from: "slow morning", to: "early start" },
        reach: "part",
        side: "to",
        day: itinerary.stops,
        other: merged.itinerary.stops,
        windows: windowsOf(itinerary, windows),
      }),
    ).toEqual({ words: "Starts 07:30, not 10:00 · 1 new stop, 2 earlier", end: null });
  });
});
