import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ENERGY_LEVELS } from "@/lib/schema/itinerary.schema";
import { EnergyGlyph, PLACES } from "./energy-glyph";

function glyphOf(level: (typeof ENERGY_LEVELS)[number], isDayLevel?: boolean) {
  const { container } = render(<EnergyGlyph level={level} isDayLevel={isDayLevel} />);
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("No glyph drawn");
  return svg;
}

describe("EnergyGlyph", () => {
  it("draws five places along one wire, quiet at the left, as open rings", () => {
    const rings = [...glyphOf("calm").querySelectorAll("[data-place]")];

    expect(rings).toHaveLength(ENERGY_LEVELS.length);
    expect(rings.map((ring) => Number(ring.getAttribute("cx")))).toEqual([3, 9, 15, 21, 27]);
    rings.forEach((ring) => expect(ring).toHaveAttribute("fill", "none"));
  });

  it.each(ENERGY_LEVELS.map((level, index) => [level, index] as const))(
    "sets the bead at %s's place, the place counted from quiet",
    (level, index) => {
      const bead = glyphOf(level).querySelectorAll("[data-bead]");

      expect(bead).toHaveLength(1);
      expect(Number(bead[0]?.getAttribute("cx"))).toBe(PLACES[index]);
    },
  );

  it("fills the bead, larger than a ring, so the two differ by shape where colours are forced", () => {
    const svg = glyphOf("lively");
    const bead = svg.querySelector("[data-bead]");
    const ring = svg.querySelector("[data-place]");

    expect(bead).not.toHaveAttribute("fill", "none");
    expect(Number(bead?.getAttribute("r"))).toBeGreaterThan(Number(ring?.getAttribute("r")));
  });

  it("draws the day's bead in energy's colour and another level's in its words' colour", () => {
    expect(glyphOf("social", true).querySelector("[data-bead]")).toHaveClass("fill-energy");
    expect(glyphOf("social").querySelector("[data-bead]")).toHaveClass("fill-current");
  });

  it("is hidden from a screen reader, since the word beside it names the level", () => {
    expect(glyphOf("balanced")).toHaveAttribute("aria-hidden", "true");
  });
});
