import { describe, expect, it } from "vitest";
import { ALPHA_3_CODES, isCountryCalled } from "./country-names";

describe("ALPHA_3_CODES", () => {
  const regions = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" });

  it("holds every assigned ISO 3166-1 code, each once", () => {
    const alpha3s = [...ALPHA_3_CODES.values()];
    expect(ALPHA_3_CODES.size).toBe(249);
    expect(new Set(alpha3s).size).toBe(alpha3s.length);
    for (const alpha3 of alpha3s) expect(alpha3).toMatch(/^[a-z]{3}$/);
  });

  it("keys each by a region code the platform knows", () => {
    for (const alpha2 of ALPHA_3_CODES.keys()) {
      expect(regions.of(alpha2.toUpperCase())).not.toBe(alpha2.toUpperCase());
    }
  });

  it.each([
    ["gb", "gbr"],
    ["us", "usa"],
    ["pt", "prt"],
    ["jp", "jpn"],
    ["de", "deu"],
    ["ch", "che"],
    ["ae", "are"],
    ["kr", "kor"],
  ])("reads %s as %s", (alpha2, alpha3) => {
    expect(ALPHA_3_CODES.get(alpha2)).toBe(alpha3);
  });
});

describe("isCountryCalled", () => {
  it.each(["UK", "U.K.", "uk", "GB", "GBR", "Great Britain"])(
    "reads %s as the United Kingdom",
    (word) => {
      expect(isCountryCalled(word, "gb")).toBe(true);
    },
  );

  // They are the result's `state`, matched there, so Edinburgh is never in England.
  it.each(["England", "Scotland", "Wales", "Northern Ireland"])(
    "leaves %s to the result's own state",
    (nation) => {
      expect(isCountryCalled(nation, "gb")).toBe(false);
    },
  );

  it.each(["US", "U.S.", "USA", "U.S.A.", "America"])("reads %s as the United States", (word) => {
    expect(isCountryCalled(word, "us")).toBe(true);
  });

  it("reads UAE and a country's own codes", () => {
    expect(isCountryCalled("UAE", "ae")).toBe(true);
    expect(isCountryCalled("FR", "fr")).toBe(true);
    expect(isCountryCalled("FRA", "FR")).toBe(true);
  });

  it("refuses a word for another country", () => {
    expect(isCountryCalled("UK", "ca")).toBe(false);
    expect(isCountryCalled("Canada", "gb")).toBe(false);
    expect(isCountryCalled("USA", "au")).toBe(false);
    expect(isCountryCalled("FRA", "de")).toBe(false);
    expect(isCountryCalled("constructor", "gb")).toBe(false);
  });
});
