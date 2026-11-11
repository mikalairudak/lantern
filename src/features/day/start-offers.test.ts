import { describe, expect, it } from "vitest";
import { START_REQUESTS } from "@/lib/days/written/quick-starts";
import { startOffersOf } from "./start-offers";
import { writtenPool } from "./written-pool";

describe("startOffersOf", () => {
  it("offers each written day, in the order the index sets them", () => {
    expect(startOffersOf(writtenPool()).map(({ request }) => request)).toEqual(START_REQUESTS);
  });

  it("says which start has no day, rather than offer one that cannot open", () => {
    const pool = writtenPool().filter(({ request }) => request.city !== "Porto");

    expect(() => startOffersOf(pool)).toThrow("The start for Porto has no written day");
  });
});
