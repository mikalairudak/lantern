import { describe, expect, it } from "vitest";
import { writtenDayAt } from "@/lib/days/written/days";
import { mergeShownReplan, movedStopsOf } from "@/lib/replan/merge";
import { replanPlanOf } from "@/lib/replan/windows";
import { KANAZAWA_LATE_DINNER } from "./kanazawa-dinner";

const kanazawa = writtenDayAt("kanazawa");
if (!kanazawa) throw new Error("Kanazawa is a written day");
const request = { ...kanazawa.request, dinner: "late" as const };

describe("Kanazawa's late dinner re-plan", () => {
  it("rewrites the written day's last two stops, as the page reads them", () => {
    expect(replanPlanOf(kanazawa.itinerary, request, "dinner")).toEqual({
      kind: "targeted",
      windows: [{ from: 6, to: 7 }],
    });
  });

  it("merges whole, as the visitor is shown it, dinner at 20:45", () => {
    const merged = mergeShownReplan({
      itinerary: kanazawa.itinerary,
      request,
      changed: "dinner",
      windows: [{ from: 6, to: 7 }],
      replan: KANAZAWA_LATE_DINNER,
      idPrefix: "r1",
    });
    if (!merged.ok) throw new Error(merged.reason);

    expect(merged.itinerary.stops.slice(6).map((stop) => `${stop.id} ${stop.startTime}`)).toEqual([
      "r1-stop-0 17:00",
      "r1-stop-1 18:30",
      "r1-stop-2 20:45",
    ]);
  });

  it("writes two stops at new places and moves the part's own dinner later", () => {
    const basis = {
      itinerary: kanazawa.itinerary,
      request,
      changed: "dinner" as const,
      windows: [{ from: 6, to: 7 }],
      idPrefix: "r1",
    };
    const merged = mergeShownReplan({ ...basis, replan: KANAZAWA_LATE_DINNER });
    if (!merged.ok) throw new Error(merged.reason);

    // Oden in Katamachi, at 17:30 before, is the part's own place at 20:45.
    expect([...movedStopsOf(basis, merged.itinerary.stops)]).toEqual([["r1-stop-2", "later"]]);
  });
});
