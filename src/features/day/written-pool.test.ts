import { describe, expect, it } from "vitest";
import { daySlugOf } from "@/lib/days/address";
import { writtenDayAt } from "@/lib/days/written/days";
import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import { shownPool, writtenPool } from "./written-pool";

describe("writtenPool", () => {
  it("hands over every written day's words and shape, in the order the starts offer them", () => {
    const pool = writtenPool();

    expect(pool.map(({ request }) => request)).toEqual(WRITTEN_REQUESTS);
    for (const { request, facts, energies } of pool) {
      const written = writtenDayAt(daySlugOf(request))!;
      expect(facts).toEqual(written.itinerary.facts);
      expect(energies).toHaveLength(written.itinerary.stops.length);
    }
  });

  it("finds every written day at its own address, as the pool hands it over", () => {
    for (const pick of writtenPool()) {
      expect(writtenDayAt(daySlugOf(pick.request))?.request).toEqual(pick.request);
    }
  });
});

describe("shownPool", () => {
  it("hands over each start's words with the season its page shows, one season each today", () => {
    expect(shownPool(new Date("2026-11-11T12:00:00Z"))).toEqual(writtenPool());
  });
});
