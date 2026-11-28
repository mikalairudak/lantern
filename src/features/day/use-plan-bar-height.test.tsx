import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_BAR_HEIGHT_PROPERTY, usePlanBarHeight } from "./use-plan-bar-height";

/** The observer's callback, called by a test as the bar's height changes. */
let resized: (() => void) | null = null;

class ManualObserver {
  constructor(callback: () => void) {
    resized = callback;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    resized = null;
  }
}

/** A bar whose box is `height` px tall. */
function barOf(height: { px: number }): HTMLElement {
  const bar = document.createElement("div");
  vi.spyOn(bar, "getBoundingClientRect").mockImplementation(
    () => ({ height: height.px }) as DOMRect,
  );
  return bar;
}

const rootHeight = () => document.documentElement.style.getPropertyValue(PLAN_BAR_HEIGHT_PROPERTY);

beforeEach(() => vi.stubGlobal("ResizeObserver", ManualObserver));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the plan's bar's height on the root", () => {
  it("is the bar's box, rounded up to a whole pixel, and follows it as it wraps", () => {
    const height = { px: 28.5 };
    renderHook(() => usePlanBarHeight(barOf(height)));
    expect(rootHeight()).toBe("29px");

    height.px = 205;
    resized?.();
    expect(rootHeight()).toBe("205px");
  });

  it("goes once the bar does", () => {
    const { rerender, unmount } = renderHook(({ bar }) => usePlanBarHeight(bar), {
      initialProps: { bar: barOf({ px: 64 }) as HTMLElement | null },
    });
    expect(rootHeight()).toBe("64px");

    rerender({ bar: null });
    expect(rootHeight()).toBe("");
    unmount();
  });
});
