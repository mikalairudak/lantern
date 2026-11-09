import { describe, expect, it } from "vitest";
import { QUICK_STARTS } from "@/lib/days/written/quick-starts";
import { startOffersOf } from "./start-offers";
import { writtenPool } from "./written-pool";

describe("startOffersOf", () => {
  it("offers each start with the shape of its own written day", () => {
    const pool = writtenPool();
    const offers = startOffersOf(pool);

    expect(offers.map(({ country }) => country)).toEqual(QUICK_STARTS.map((s) => s.country));
    for (const offer of offers) {
      const written = pool.find(({ request }) => request === offer.request);
      expect(offer.energies).toEqual(written!.energies);
    }
  });

  it("says which start has no day, rather than offer one that cannot open", () => {
    const pool = writtenPool().filter(({ request }) => request.city !== "Porto");

    expect(() => startOffersOf(pool)).toThrow("The start for Portugal has no written day");
  });
});
