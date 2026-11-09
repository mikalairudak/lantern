import { describe, expect, it } from "vitest";
import { REFUSED_DAY } from "@/lib/fixtures/edge/edge-days";
import { EDGE_FRAMES, edgeDayOf, edgeItineraryOf } from "./edge-frames";

describe("edge frames", () => {
  it("opens every edge day by its path, and nothing else", () => {
    for (const frame of EDGE_FRAMES) expect(edgeDayOf(frame.key)).toBe(frame.day);
    expect(edgeDayOf("refused")).toBeNull();
    expect(edgeDayOf(undefined)).toBeNull();
  });

  it("makes an itinerary of every edge day it lists", () => {
    for (const frame of EDGE_FRAMES) {
      expect(edgeItineraryOf(frame.day).stops.length).toBeGreaterThan(0);
    }
  });

  it("says which fixture broke when a day is refused", () => {
    expect(() => edgeItineraryOf(REFUSED_DAY)).toThrow(REFUSED_DAY.edge);
  });
});
