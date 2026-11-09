import { describe, expect, it } from "vitest";
import {
  DayRequestSchema,
  GeneratedDaySchema,
  type DayRequest,
} from "@/lib/schema/itinerary.schema";
import { CURATED_DAYS, curatedDayFor } from "./curated-days";
import { CURATED_REQUESTS, KYOTO_REQUEST } from "./requests";

// The normalizer's tests show each day normalizes without a repair, and the quality
// checks score its alternatives; these hold what is left: the fixture's own shape.
describe.each(CURATED_DAYS)("the curated day in $request.city", ({ request, day }) => {
  it("answers a valid request", () => {
    expect(DayRequestSchema.parse(request)).toEqual(request);
  });

  it("is exactly what the generation schema allows", () => {
    expect(GeneratedDaySchema.parse(day)).toEqual(day);
  });

  it("gives every stop one set of alternatives, in stop order", () => {
    expect(day.alternatives.map((set) => set.stopIndex)).toEqual(day.stops.map((_, i) => i));
  });
});

describe("curatedDayFor", () => {
  it.each(CURATED_REQUESTS)("finds the day written for $city's request", (request) => {
    expect(curatedDayFor({ ...request })?.request).toEqual(request);
  });

  it("offers the requests in the order of the days, so the hero day comes first", () => {
    expect(CURATED_REQUESTS).toEqual(CURATED_DAYS.map(({ request }) => request));
  });

  it.each<[string, Partial<DayRequest>]>([
    ["another city", { city: "Osaka", timezone: "Asia/Tokyo" }],
    ["another date", { date: "2026-11-15" }],
    ["another energy word", { energy: "lively" }],
    ["a word the visitor chose that the day only assumed", { travel: "on-foot" }],
  ])("finds nothing for %s", (_name, change) => {
    expect(curatedDayFor({ ...KYOTO_REQUEST, ...change })).toBeNull();
  });

  it.each(Object.keys(KYOTO_REQUEST))("matches on %s, as on every field of the request", (key) => {
    const changed = { ...KYOTO_REQUEST, [key]: "something else" } as DayRequest;
    expect(curatedDayFor(changed)).toBeNull();
  });
});
