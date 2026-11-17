import { render } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { IndexPlate } from "./index-picture";
import { INDEX_PICTURES } from "./index-picture-files";
import { NO_LAMPS_PICTURE } from "./index-picture-examples";
import { lightCirclesOf, poolRadiiOf } from "./plate-light";
import {
  drawnBoxOf,
  POOL_TOKENS,
  stillLightBoxOf,
  stillPlateBoxOf,
  stillPlateOf,
  type StillLight,
} from "./still-plate";

const TOKYO = INDEX_PICTURES.tokyo!;
const PARIS = INDEX_PICTURES.paris!;
const SEOUL = INDEX_PICTURES.seoul!;
const MASKS = { scene: "scene.png", sheet: "sheet.png" };
const COLORS = { engraving: "ink", "plate-lit": "lit", "plate-half": "half" };
const ON_CARD = { scale: 1.4, centre: 600, foot: 361 };

function drawn(light: StillLight, picture = TOKYO) {
  return render(stillPlateOf({ picture, masks: MASKS, colors: COLORS, placement: ON_CARD, light }))
    .container;
}

/** Every element type in a tree, with what the renderer would be given. */
function typesIn(node: ReactNode): unknown[] {
  if (Array.isArray(node)) return node.flatMap(typesIn);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node.type, ...typesIn(node.props.children)];
}

describe("a plate held still", () => {
  it("stands its box where its scale, its field's centre and its foot put it", () => {
    const box = stillPlateBoxOf(TOKYO, ON_CARD);
    expect(box.left).toBeCloseTo(425.07, 2);
    expect(box.left + box.width).toBeCloseTo(774.93, 2);
    expect(box.top).toBeCloseTo(46.7, 1);
    expect(box.top + box.height).toBe(361);
    const paris = stillPlateBoxOf(PARIS, { ...ON_CARD, centre: 250 });
    expect(paris.top).toBeCloseTo(32.3, 1);
  });

  it("stands its light's box inside its own, from its scene's side to its foot", () => {
    const light = stillLightBoxOf(TOKYO, ON_CARD);
    expect(light.left).toBeCloseTo(426.8, 1);
    expect(light.left + light.width).toBeCloseTo(773.3, 1);
    expect(light.top + light.height).toBeCloseTo(361);
  });

  it("covers its light where the light passes its box at the sides, as Seoul's does", () => {
    const [left, , width] = drawnBoxOf(SEOUL);
    expect(left).toBeLessThan(SEOUL.light[0] + 0.001);
    expect(left + width).toBeGreaterThanOrEqual(SEOUL.light[0] + SEOUL.light[2]);
  });

  it("draws only plain SVG elements, which the renderer draws inside an SVG", () => {
    for (const light of ["rest", "lit"] as const) {
      const plate = stillPlateOf({
        picture: TOKYO,
        masks: MASKS,
        colors: COLORS,
        placement: ON_CARD,
        light,
      });
      expect(typesIn(plate).every((type) => typeof type === "string")).toBe(true);
    }
  });

  it("draws its lines in the engraving's colour through the scene's file, and bounds its light by the sheet's", () => {
    const container = drawn("rest");
    const hrefs = [...container.querySelectorAll("image")].map((image) =>
      image.getAttribute("href"),
    );
    expect(hrefs).toEqual(["scene.png", "sheet.png"]);
    expect(container.querySelector('rect[mask="url(#ink)"]')).toHaveAttribute("fill", "ink");
  });

  it("burns low at rest in a pool of three steps at each lamp, as the page's pools are painted", () => {
    const container = drawn("rest");
    const radii = poolRadiiOf(TOKYO);
    for (const step of ["edge", "pool", "heart"] as const) {
      const circles = container.querySelectorAll(`mask#pool-${step} circle`);
      expect(circles).toHaveLength(TOKYO.lamps.length);
      expect(circles[0]).toHaveAttribute("r", String(radii[step]));
      expect(container.querySelector(`rect[mask="url(#pool-${step})"]`)).toHaveAttribute(
        "fill",
        COLORS[POOL_TOKENS[step]],
      );
    }
    expect(container.querySelector("mask#whole")).toBeNull();
  });

  it("is lit whole from every source at its lit reach, over its pools", () => {
    const container = drawn("lit");
    const radii = [...container.querySelectorAll("mask#whole circle")].map((circle) =>
      Number(circle.getAttribute("r")),
    );
    expect(radii).toEqual(lightCirclesOf(TOKYO).map(({ reaches }) => reaches.lit));
    expect(container.querySelector('rect[mask="url(#whole)"]')).toHaveAttribute("fill", "lit");
    expect(container.querySelector("mask#pool-edge")).not.toBeNull();
  });

  it("is lit from its middle where it has no lamps, with no pools at rest", () => {
    expect(drawn("rest", NO_LAMPS_PICTURE).querySelector("mask#pool-edge")).toBeNull();
    expect(drawn("lit", NO_LAMPS_PICTURE).querySelectorAll("mask#whole circle")).toHaveLength(1);
  });

  it("paints each step of a pool in the colour the page's plate paints it", () => {
    const { container } = render(<IndexPlate picture={TOKYO} />);
    const steps = [...container.querySelectorAll("[data-pools] rect")].map((rect) =>
      rect.getAttribute("class"),
    );
    expect(steps).toEqual(
      (["edge", "pool", "heart"] as const).map((step) => `fill-${POOL_TOKENS[step]}`),
    );
  });
});
