import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MARK_WIRES } from "@/components/ui/lantern-mark";
import { SITE_NAME } from "@/lib/site";
import { lockupLayoutOf, stillLockupOf } from "./still-lockup";

/** "Lantern" in the wordmark's cut at 72 px, and where a baseline stands at line height 1. */
const WORD_AT_72 = 262.7;
const BASELINE_SHARE = 0.85;
const COLORS = { ink: "ink", lamp: "lamp", "lamp-glow": "glow", "lamp-haze": "haze" };

describe("the lockup held still", () => {
  it("centres the mark and the word on x as one pair, the bead on the middle of the x-height", () => {
    const { mark, word, width } = lockupLayoutOf(
      { size: 72, baseline: 453, x: 600, align: "centre" },
      WORD_AT_72,
      BASELINE_SHARE,
    );
    expect(width).toBeCloseTo(417.8, 1);
    expect(mark.left).toBeCloseTo(391.1, 1);
    expect(mark.size).toBeCloseTo(126);
    expect(mark.bead.x).toBeCloseTo(454.1, 1);
    expect(mark.bead.y).toBeCloseTo(434.7, 1);
    expect(word.left).toBeCloseTo(546.2, 1);
    expect(word.top).toBeCloseTo(391.8, 1);
  });

  it("starts at x where it is set from the left, as a masthead stands", () => {
    const { mark, word } = lockupLayoutOf(
      { size: 36, baseline: 82, x: 64, align: "start" },
      WORD_AT_72 / 2,
      BASELINE_SHARE,
    );
    expect(mark.left).toBe(64);
    expect(mark.bead).toEqual({ x: expect.closeTo(95.5, 1), y: expect.closeTo(72.9, 1) });
    expect(word.left).toBeCloseTo(141.5, 1);
  });

  it("draws the large mark from 64 px and the master under it", () => {
    const at = (size: number) =>
      lockupLayoutOf({ size, baseline: 100, x: 0, align: "start" }, 100, BASELINE_SHARE).mark.wire;
    expect(at(72)).toBe(MARK_WIRES.large);
    expect(at(36)).toBe(MARK_WIRES.master);
  });

  it("draws the mark in the lamp's colours and the ink, and says the name in the word", () => {
    const layout = lockupLayoutOf(
      { size: 72, baseline: 453, x: 600, align: "centre" },
      WORD_AT_72,
      BASELINE_SHARE,
    );
    const { container } = render(stillLockupOf({ layout, colors: COLORS }));
    const fills = [...container.querySelectorAll("circle, ellipse")].map((shape) =>
      shape.getAttribute("fill"),
    );
    expect(fills).toEqual(["haze", "glow", "lamp"]);
    const wires = container.querySelectorAll("path");
    expect([...wires].map((wire) => wire.getAttribute("d"))).toEqual([
      MARK_WIRES.large.left,
      MARK_WIRES.large.right,
    ]);
    expect(wires[0]).toHaveAttribute("stroke", "ink");
    expect(container).toHaveTextContent(SITE_NAME);
  });
});
