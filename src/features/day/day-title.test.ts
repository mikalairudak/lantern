import { describe, expect, it } from "vitest";
import { dayAddressOfId } from "@/lib/days/address";
import { BOLOGNA_START_REQUEST, KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { dayTitleOf } from "./day-title";

const PARIS = { ...KANAZAWA_START_REQUEST, city: "Paris", timezone: "Europe/Paris" };

describe("dayTitleOf", () => {
  it("names a written day by its sentence, as its own page's title does", () => {
    expect(dayTitleOf(KANAZAWA_START_REQUEST)).toBe(
      "A calm Saturday in Kanazawa, early start · Lantern",
    );
    expect(dayTitleOf(BOLOGNA_START_REQUEST)).toBe(
      "A lively Saturday in Bologna, with friends · Lantern",
    );
  });

  it("says the energy re-picked on the day on screen, as its headline does", () => {
    expect(dayTitleOf(KANAZAWA_START_REQUEST, "lively")).toBe(
      "A lively Saturday in Kanazawa, early start · Lantern",
    );
  });

  it("is Lantern's own wherever the address is the start screen's", () => {
    expect(dayTitleOf(null)).toBe("Lantern");
    expect(dayTitleOf(PARIS)).toBe("Lantern");
  });

  it("names a day of the visitor's by its sentence once it has its id's address", () => {
    const address = dayAddressOfId("1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b");
    expect(dayTitleOf(PARIS, undefined, address)).toMatch(/^A .* · Lantern$/);
    expect(dayTitleOf(PARIS, undefined, "/")).toBe("Lantern");
  });
});
