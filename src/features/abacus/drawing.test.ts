import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BROWSER_TEXT_ATTRIBUTE, DEFAULT_ROOT_PX } from "@/lib/tokens/root";
import { drawingAt, useDrawing } from "./drawing";
import { CHART, HAIRLINE } from "./geometry";
import { DEFAULT_DRAWING, ROW } from "./rows";

/** The root's size at 2560 px wide at the default text size: a quarter over the browser's own. */
const LARGE_ROOT_PX = 20;
const LARGE_FACTOR = LARGE_ROOT_PX / DEFAULT_ROOT_PX;
/** The browser's own text at 125 %, and the root it grows to at 2560 px wide from there. */
const LARGE_TEXT_PX = 20;
const LARGE_TEXT_ROOT_AT_2560_PX = 22.7143;

/**
 * jsdom computes no font sizes: the root, and the root layout's unseen element at the
 * browser's own size where there is one, read as a browser would set them.
 */
function setSizes({ root, browser }: { root: number; browser?: number }) {
  const probe = document.createElement("span");
  probe.setAttribute(BROWSER_TEXT_ATTRIBUTE, "");
  if (browser !== undefined) document.body.append(probe);
  const read = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = read(element, pseudo);
    const size = element === document.documentElement ? root : element === probe ? browser : null;
    return size === null || size === undefined
      ? style
      : Object.assign(Object.create(style) as CSSStyleDeclaration, { fontSize: `${size}px` });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelector(`[${BROWSER_TEXT_ATTRIBUTE}]`)?.remove();
});

describe("the drawing at a factor", () => {
  it("is the drawing as written at 1, the same objects", () => {
    expect(drawingAt(1)).toBe(DEFAULT_DRAWING);
    expect(drawingAt(1).chart).toBe(CHART);
    expect(drawingAt(1).row).toBe(ROW);
  });

  it("scales every place, size and gap of the chart and its rows by one factor", () => {
    const { chart, row } = drawingAt(LARGE_FACTOR);

    for (const [key, value] of Object.entries(CHART)) {
      expect(chart[key as keyof typeof CHART], key).toBeCloseTo(value * LARGE_FACTOR, 9);
    }
    for (const [key, value] of Object.entries(ROW)) {
      expect(row[key as keyof typeof ROW], key).toBeCloseTo(value * LARGE_FACTOR, 9);
    }
  });

  it("makes page E's numbers at 2560 px: a 65 px gutter, 15 px beads, a 560 px sheet", () => {
    const { chart, row } = drawingAt(LARGE_FACTOR);

    expect(chart.axisWidth).toBe(65);
    expect(chart.shownBeadRadius * 2).toBe(15);
    expect(chart.beadHitRadius * 2).toBe(30);
    expect(row.sheetLeastWidth).toBe(560);
  });

  it("leaves the hairlines a pixel", () => {
    expect(HAIRLINE).toBe(1);
    expect(Object.keys(drawingAt(LARGE_FACTOR).chart)).not.toContain("hairline");
  });
});

describe("useDrawing", () => {
  it("draws at the root's growth over the browser's own text size", () => {
    setSizes({ root: LARGE_ROOT_PX, browser: DEFAULT_ROOT_PX });

    const { result } = renderHook(() => useDrawing());

    expect(result.current.chart.axisWidth).toBe(CHART.axisWidth * LARGE_FACTOR);
    expect(result.current.row.sheetLeastWidth).toBe(560);
  });

  it("draws as written in the visitor's large text until the root grows past it", () => {
    setSizes({ root: LARGE_TEXT_PX, browser: LARGE_TEXT_PX });

    const { result } = renderHook(() => useDrawing());

    expect(result.current).toBe(DEFAULT_DRAWING);
  });

  it("grows in large text only as far as the root has grown from it", () => {
    setSizes({ root: LARGE_TEXT_ROOT_AT_2560_PX, browser: LARGE_TEXT_PX });

    const { result } = renderHook(() => useDrawing());

    expect(result.current.chart.axisWidth / CHART.axisWidth).toBeCloseTo(1.1357, 4);
  });

  it("draws as written at the default size, and where nothing can be read", () => {
    const { result } = renderHook(() => useDrawing());

    expect(result.current).toBe(DEFAULT_DRAWING);
  });

  it("reads the root again when the window is resized", () => {
    const { result } = renderHook(() => useDrawing());
    expect(result.current).toBe(DEFAULT_DRAWING);

    setSizes({ root: LARGE_ROOT_PX, browser: DEFAULT_ROOT_PX });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.row.sheetLeastWidth).toBe(560);
  });
});
