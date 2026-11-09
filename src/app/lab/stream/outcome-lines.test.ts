import { describe, expect, it } from "vitest";
import { MINIMAL_DAY } from "@/lib/fixtures/edge/edge-days";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import type { DayOutcome } from "@/lib/stream/outcome";
import { outcomeLine } from "./outcome-lines";

function minimalItinerary(): Itinerary {
  const result = normalizeDay(MINIMAL_DAY.request, MINIMAL_DAY.day);
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary;
}

describe("the outcome line", () => {
  const itinerary = minimalItinerary();

  it.each<[string, DayOutcome, string]>([
    ["complete", { kind: "complete", itinerary }, "complete: 1 stop, 0 swaps"],
    ["cut with a day kept", { kind: "cut", itinerary }, "cut: kept 1 stop, 0 swaps"],
    [
      "disconnected with nothing kept",
      { kind: "disconnected", itinerary: null },
      "disconnected: nothing kept, so the UI shows a failure",
    ],
    ["refused", { kind: "refused" }, "refused: the partial is cleared"],
    [
      "invalid",
      { kind: "invalid", reason: "the line about the day is blank", isEmpty: false },
      "invalid: the line about the day is blank",
    ],
    ["unavailable", { kind: "unavailable" }, "unavailable: nothing arrived"],
    ["limited", { kind: "limited" }, "limited: nothing arrived"],
  ])("reads %s", (_name, outcome, line) => {
    expect(outcomeLine(outcome)).toBe(line);
  });
});
