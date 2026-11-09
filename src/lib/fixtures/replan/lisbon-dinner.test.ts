import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkReplanWindows, checkReplanWord } from "@/lib/quality/replan-checks";
import { mergeReplan } from "@/lib/replan/merge";
import { replanPlanOf } from "@/lib/replan/windows";
import { goldenReplansOf } from "./golden-replans";
import { LISBON_LATE_DINNER } from "./lisbon-dinner";

const golden = goldenReplansOf(
  readFileSync("src/lib/fixtures/replan/golden-replans.jsonl", "utf8"),
);
const lisbon = golden.find((each) => each.name === "dinner: early to late");
if (!lisbon) throw new Error("The golden set has Lisbon's dinner");
const basis = {
  itinerary: lisbon.itinerary,
  request: lisbon.request,
  changed: lisbon.changed,
  windows: lisbon.windows,
  idPrefix: "r1",
};

describe("Lisbon's late dinner re-plan", () => {
  it("rewrites the window the page reads: the last two stops", () => {
    expect(replanPlanOf(lisbon.itinerary, lisbon.request, "dinner")).toMatchObject({
      windows: [{ from: 7, to: 8 }],
    });
  });

  it("is a re-plan the route would keep: inside its window, and eating late", () => {
    expect(checkReplanWindows(basis, LISBON_LATE_DINNER).findings).toEqual([]);
    expect(checkReplanWord(basis, LISBON_LATE_DINNER).findings).toEqual([]);
  });

  it("ends the day with dinner after nine, past the old end", () => {
    const merged = mergeReplan({ ...basis, replan: LISBON_LATE_DINNER });
    if (!merged.ok) throw new Error(merged.reason);

    expect(merged.itinerary.stops.at(-1)?.primary.name).toBe("Petiscos in Alfama");
    expect(merged.itinerary.stops).toHaveLength(lisbon.itinerary.stops.length);
  });
});
