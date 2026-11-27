import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GutterTextProbe } from "./gutter-text";

/** The observer the probe makes, called back as a browser would when a copy's size changes. */
let resized: (() => void) | null = null;

class CapturingObserver {
  constructor(callback: () => void) {
    resized = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** jsdom lays nothing out: each copy's box, by the class its type comes from. */
function setSizes(time: { width: number; height: number }, minuteHeight: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const box = this.classList.contains("type-time")
      ? time
      : { width: 0, height: this.classList.contains("text-caption") ? minuteHeight : 0 };
    return { ...box, x: 0, y: 0, top: 0, left: 0, right: box.width, bottom: box.height } as DOMRect;
  });
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", CapturingObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resized = null;
});

describe("GutterTextProbe", () => {
  it("reports a time's width and the two lines' heights before the first paint", () => {
    setSizes({ width: 34.59, height: 19.5 }, 15.39);
    const onMeasure = vi.fn();

    render(<GutterTextProbe onMeasure={onMeasure} />);

    expect(onMeasure).toHaveBeenCalledWith({
      timeWidth: 34.59,
      timeHeight: 19.5,
      minuteHeight: 15.39,
    });
  });

  it("reports again when the copies change size, as when the fonts arrive", () => {
    setSizes({ width: 34.59, height: 19.5 }, 15.39);
    const onMeasure = vi.fn();
    render(<GutterTextProbe onMeasure={onMeasure} />);

    setSizes({ width: 69.16, height: 39 }, 30.8);
    act(() => resized?.());

    expect(onMeasure).toHaveBeenLastCalledWith({
      timeWidth: 69.16,
      timeHeight: 39,
      minuteHeight: 30.8,
    });
  });

  it("is unseen and unheard", () => {
    const { container } = render(<GutterTextProbe onMeasure={() => undefined} />);

    const probe = container.firstElementChild;
    expect(probe).toHaveAttribute("aria-hidden", "true");
    expect(probe).toHaveClass("invisible");
  });
});
