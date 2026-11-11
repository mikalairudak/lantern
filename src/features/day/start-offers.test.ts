import { describe, expect, it } from "vitest";
import { daySlugOf } from "@/lib/days/address";
import { QUICK_STARTS } from "@/lib/days/written/quick-starts";
import { indexOffersOf, startOffersOf } from "./start-offers";
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

describe("indexOffersOf", () => {
  it("offers the eight cities in the index's order, each named by the slug its picture has", () => {
    const pool = writtenPool();
    const offers = indexOffersOf(pool);

    expect(offers.map(({ request }) => daySlugOf(request))).toEqual([
      "paris",
      "madrid",
      "tokyo",
      "rome",
      "new-york",
      "amsterdam",
      "barcelona",
      "seoul",
    ]);
    expect(offers.map(({ country }) => country)).toEqual([
      "France",
      "Spain",
      "Japan",
      "Italy",
      "United States",
      "Netherlands",
      "Spain",
      "South Korea",
    ]);
    for (const offer of offers) {
      const written = pool.find(({ request }) => request === offer.request);
      expect(offer.energies).toEqual(written!.energies);
    }
  });

  it("says which of its days is missing, rather than offer one that cannot open", () => {
    const pool = writtenPool().filter(({ request }) => request.city !== "Seoul");

    expect(() => indexOffersOf(pool)).toThrow("The start for South Korea has no written day");
  });
});
