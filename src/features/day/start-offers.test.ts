import { describe, expect, it } from "vitest";
import { daySlugOf } from "@/lib/days/address";
import { INDEX_PICTURES } from "./index-picture-files";
import { startOffersOf } from "./start-offers";
import { writtenPool } from "./written-pool";

describe("startOffersOf", () => {
  it("offers the eight cities in the index's order, each named by the slug its picture has", () => {
    expect(startOffersOf(writtenPool()).map(({ request }) => daySlugOf(request))).toEqual([
      "paris",
      "madrid",
      "tokyo",
      "rome",
      "new-york",
      "amsterdam",
      "barcelona",
      "seoul",
    ]);
  });

  it("has an engraving for every day it offers", () => {
    const slugs = startOffersOf(writtenPool()).map(({ request }) => daySlugOf(request));
    expect(slugs.filter((slug) => INDEX_PICTURES[slug] === undefined)).toEqual([]);
  });

  it("says which of its days is missing, rather than offer one that cannot open", () => {
    const pool = writtenPool().filter(({ request }) => request.city !== "Seoul");

    expect(() => startOffersOf(pool)).toThrow("The start for Seoul has no written day");
  });
});
