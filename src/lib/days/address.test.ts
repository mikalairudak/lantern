import { describe, expect, it } from "vitest";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { dayAddressOf, daySlugOf } from "./address";
import { BOLOGNA_START_REQUEST, KANAZAWA_START_REQUEST } from "./written/quick-starts";
import { WRITTEN_REQUESTS } from "./written/requests";

describe("daySlugOf", () => {
  it("names a written day by its city", () => {
    expect(daySlugOf(BOLOGNA_START_REQUEST)).toBe("bologna");
  });

  it("gives every written day an address of its own, as a URL says it unescaped", () => {
    const slugs = WRITTEN_REQUESTS.map(daySlugOf);

    expect(new Set(slugs).size).toBe(WRITTEN_REQUESTS.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each([
    ["São Paulo", "sao-paulo"],
    ["Hōnen-in", "honen-in"],
    ["St. Petersburg", "st-petersburg"],
  ])("says %s as %s", (city, slug) => {
    expect(daySlugOf({ ...BOLOGNA_START_REQUEST, city })).toBe(slug);
  });
});

const PARIS = { ...KANAZAWA_START_REQUEST, city: "Paris", timezone: "Europe/Paris" };

describe("dayAddressOf", () => {
  it("names a written day on screen by its own address", () => {
    expect(dayAddressOf(KANAZAWA_START_REQUEST)).toBe("/day/kanazawa");
  });

  it("names a written day played again as a copy of its request", () => {
    expect(dayAddressOf({ ...BOLOGNA_START_REQUEST })).toBe("/day/bologna");
  });

  it("is the start screen's while the start screen shows, with no day on screen", () => {
    expect(dayAddressOf(null)).toBe("/");
  });

  it("names every written day by its own address", () => {
    for (const request of WRITTEN_REQUESTS) expect(dayAddressOf(request)).toMatch(/^\/day\//);
  });

  it("gives a day Lantern has not written the start screen's address", () => {
    expect(dayAddressOf(PARIS)).toBe("/");
    // A day written by hand is a fixture, at no address of the site's.
    expect(dayAddressOf(KYOTO_REQUEST)).toBe("/");
  });

  it("gives a written city asked for in other words the start screen's address", () => {
    expect(dayAddressOf({ ...KANAZAWA_START_REQUEST, energy: "lively" })).toBe("/");
    expect(dayAddressOf({ ...BOLOGNA_START_REQUEST, citySource: "assumed" })).toBe("/");
  });
});
