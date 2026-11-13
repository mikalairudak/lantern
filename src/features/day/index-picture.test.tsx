import { act, fireEvent, render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndexPictureView, IndexPlate } from "./index-picture";
import { INDEX_PICTURES } from "./index-picture-files";
import { MISSING_FILES_PICTURE, NO_LAMPS_PICTURE } from "./index-picture-examples";
import { lightCirclesOf } from "./plate-light";

/** The observer the picture made, so a test can bring its cell near the screen. */
let near: ((isNear: boolean) => void) | null = null;

class TestObserver {
  constructor(private readonly onChange: IntersectionObserverCallback) {
    near = (isIntersecting) =>
      this.onChange(
        [{ isIntersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  near = null;
  vi.stubGlobal("IntersectionObserver", TestObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Every file the plate has asked for, once each image that holds one. */
function hrefsOf(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("image")].map((image) => image.getAttribute("href"));
}

function linesOf(container: HTMLElement): Element {
  return container.querySelector('rect[data-layer="scene"]')!;
}

/** A mask's circles, by the mask's name within the plate. */
function circlesIn(container: HTMLElement, name: string): Element[] {
  const mask = [...container.querySelectorAll("mask")].find((each) => each.id.endsWith(`-${name}`));
  return [...(mask?.querySelectorAll("circle") ?? [])];
}

describe("a city's plate in the index", () => {
  it("draws nothing for a city with no picture", () => {
    const { container } = render(<IndexPictureView slug="lisbon" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden from what a screen reader reads, and never takes the focus", () => {
    const { container } = render(<IndexPictureView slug="rome" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("data-picture", "rome");
  });

  it("asks for nothing until its cell comes near the screen, then for its scene alone", () => {
    const { container } = render(<IndexPictureView slug="rome" />);
    expect(hrefsOf(container)).toEqual([]);
    act(() => near?.(false));
    expect(hrefsOf(container)).toEqual([]);
    act(() => near?.(true));
    const scene = `/pictures/${INDEX_PICTURES.rome!.scene.files.narrow}`;
    // The lines, and both bounds, which are read from the scene's own file.
    expect(hrefsOf(container)).toEqual([scene, scene, scene]);
  });

  it("asks for nothing while a lab holds its files back", () => {
    const { container } = render(<IndexPictureView slug="rome" shouldAskFiles={false} />);
    act(() => near?.(true));
    expect(hrefsOf(container)).toEqual([]);
    expect(linesOf(container)).toHaveAttribute("data-state", "held");
  });

  it("asks at once where nothing can tell when it comes near the screen", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<IndexPictureView slug="paris" />);
    expect(hrefsOf(container)[0]).toBe(`/pictures/${INDEX_PICTURES.paris!.scene.files.narrow}`);
  });

  it("is loading until every part has come in, then drawn once faded in", async () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <IndexPictureView slug="seoul" />
      </MotionConfig>,
    );
    const lines = linesOf(container);
    expect(lines).toHaveAttribute("data-state", "unasked");
    act(() => near?.(true));
    expect(lines).toHaveAttribute("data-state", "loading");
    const [first, ...rest] = container.querySelectorAll("image");
    fireEvent.load(first!);
    expect(lines).toHaveAttribute("data-state", "loading");
    for (const image of rest) fireEvent.load(image);
    await vi.waitFor(() => expect(lines).toHaveAttribute("data-state", "drawn"));
  });

  it("is never drawn once a file fails", () => {
    const { container } = render(<IndexPlate picture={MISSING_FILES_PICTURE} />);
    act(() => near?.(true));
    const [first, ...rest] = container.querySelectorAll("image");
    fireEvent.error(first!);
    for (const image of rest) fireEvent.load(image);
    expect(linesOf(container)).toHaveAttribute("data-state", "failed");
  });

  it("burns each lamp low in three steps: half-light at the edge, the light in the pool and its heart", () => {
    const { container } = render(<IndexPictureView slug="tokyo" />);
    const pools = container.querySelector("[data-pools]")!;
    expect([...pools.querySelectorAll("rect")].map((rect) => rect.getAttribute("class"))).toEqual([
      "fill-plate-half",
      "fill-plate-lit",
      "fill-plate-lit",
    ]);
    const lamps = INDEX_PICTURES.tokyo!.lamps.length;
    for (const step of ["pool-edge", "pool-pool", "pool-heart"]) {
      expect(circlesIn(container, step)).toHaveLength(lamps);
    }
    // Under forced colours no light is drawn.
    expect(pools.parentElement).toHaveClass("forced-colors:hidden");
  });

  it("draws no pool on a plate with no lamps", () => {
    const { container } = render(<IndexPlate picture={NO_LAMPS_PICTURE} />);
    expect(container.querySelector("[data-pools]")).toBeNull();
    expect(circlesIn(container, "pool-edge")).toEqual([]);
  });

  it("bounds its light by theme through one mask, from two fills each nothing in one theme", () => {
    const { container } = render(<IndexPictureView slug="madrid" />);
    const light = [...container.querySelectorAll("mask")].find((mask) =>
      mask.id.endsWith("-light"),
    )!;
    expect([...light.querySelectorAll("rect")].map((rect) => rect.getAttribute("class"))).toEqual([
      "fill-plate-tone",
      "fill-plate-lit-wide",
    ]);
    expect(light.querySelector("g")?.getAttribute("filter")).toMatch(/bounds-grain\)$/);
  });

  it("grows its light from each lamp, and lays the lit fill under forced colours' hiding", () => {
    const { container } = render(<IndexPictureView slug="amsterdam" />);
    const fill = container.querySelector("[data-lit-fill]")!;
    expect(fill).toHaveClass("fill-plate-lit");
    expect(fill.parentElement).toHaveClass("forced-colors:hidden");
    const lamps = INDEX_PICTURES.amsterdam!.lamps.length;
    expect(circlesIn(container, "whole")).toHaveLength(lamps);
  });

  it("is at rest with its light out, and lit whole at once under reduced motion", async () => {
    const picture = INDEX_PICTURES.rome!;
    const [{ reaches } = { reaches: { lit: 0 } }] = lightCirclesOf(picture);
    const { container, rerender } = render(
      <MotionConfig reducedMotion="always">
        <IndexPlate picture={picture} />
      </MotionConfig>,
    );
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-light", "rest");
    expect(circlesIn(container, "whole")[0]).toHaveAttribute("r", "0");
    rerender(
      <MotionConfig reducedMotion="always">
        <IndexPlate picture={picture} isLit />
      </MotionConfig>,
    );
    expect(svg).toHaveAttribute("data-light", "lit");
    // Motion writes a radius in its next frame.
    await vi.waitFor(() =>
      expect(circlesIn(container, "whole")[0]).toHaveAttribute("r", String(reaches.lit)),
    );
    rerender(
      <MotionConfig reducedMotion="always">
        <IndexPlate picture={picture} />
      </MotionConfig>,
    );
    await vi.waitFor(() => expect(circlesIn(container, "whole")[0]).toHaveAttribute("r", "0"));
  });

  it("holds its light where a lab cell holds it", () => {
    const picture = INDEX_PICTURES.tokyo!;
    const covering = lightCirclesOf(picture).map(({ reaches }) => String(reaches.covering));
    const { container } = render(
      <IndexPlate picture={picture} still={{ reach: "covering", share: 1 }} />,
    );
    expect(circlesIn(container, "whole").map((circle) => circle.getAttribute("r"))).toEqual(
      covering,
    );
  });

  it("lights a plate with no lamps from one circle at its middle", () => {
    const { container } = render(<IndexPlate picture={NO_LAMPS_PICTURE} />);
    const [left, top, width, height] = NO_LAMPS_PICTURE.scene.box;
    const [circle, ...others] = circlesIn(container, "whole");
    expect(others).toEqual([]);
    expect(Number(circle!.getAttribute("cx"))).toBeCloseTo(left + width / 2);
    expect(Number(circle!.getAttribute("cy"))).toBeCloseTo(top + height / 2);
  });
});
