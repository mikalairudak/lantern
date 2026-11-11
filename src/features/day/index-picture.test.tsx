import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyThemeChoice } from "@/features/theme/theme";
import { IndexPictureView } from "./index-picture";
import { INDEX_PICTURES } from "./index-picture-files";

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

/** A fill as a browser computes it: the page's ink, and the transparent of the other theme. */
// eslint-disable-next-line no-restricted-syntax -- a computed colour, as getComputedStyle reads it
const INK_FILL = "rgb(0, 25, 36)";
// eslint-disable-next-line no-restricted-syntax -- a computed colour, as getComputedStyle reads it
const NO_FILL = "rgba(0, 0, 0, 0)";

/** The theme the test draws in: the layer of the other theme is transparent, as the page's is. */
let theme: "light" | "dark" = "light";
const realComputedStyle = window.getComputedStyle;

beforeEach(() => {
  near = null;
  theme = "light";
  vi.stubGlobal("IntersectionObserver", TestObserver);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = realComputedStyle(element, pseudo);
    const layer = element.getAttribute("data-layer");
    if (layer === null) return style;
    const isShown = (layer === "scene") === (theme === "light");
    return {
      ...style,
      fill: isShown ? INK_FILL : NO_FILL,
    } as CSSStyleDeclaration;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function hrefsOf(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("rect[data-layer]")].map((rect) => {
    // `url(#id)`: the mask by its id, which React makes and a selector would have to escape.
    const mask = document.getElementById(rect.getAttribute("mask")!.slice("url(#".length, -1));
    return mask?.querySelector("image")?.getAttribute("href") ?? null;
  });
}

describe("a city's picture in the index", () => {
  it("draws nothing for a city with no picture", () => {
    const { container } = render(<IndexPictureView slug="lisbon" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden from what a screen reader reads, and never takes the focus", () => {
    const { container } = render(<IndexPictureView slug="rome" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("asks for nothing until its cell comes near the screen, then only for its theme's layer", () => {
    const { container } = render(<IndexPictureView slug="rome" />);
    expect(hrefsOf(container)).toEqual([null, null]);
    act(() => near?.(false));
    expect(hrefsOf(container)).toEqual([null, null]);
    act(() => near?.(true));
    const rome = INDEX_PICTURES.rome!;
    expect(hrefsOf(container)).toEqual([`/pictures/${rome.scene.files.narrow}`, null]);
  });

  it("asks for the dark theme's subject alone in the dark", () => {
    theme = "dark";
    const { container } = render(<IndexPictureView slug="madrid" />);
    act(() => near?.(true));
    expect(hrefsOf(container)).toEqual([
      null,
      `/pictures/${INDEX_PICTURES.madrid!.subject.files.narrow}`,
    ]);
  });

  it("asks for the other layer once the theme changes, and keeps the one it has", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((step) => {
      step(0);
      return 0;
    });
    const { container } = render(<IndexPictureView slug="tokyo" />);
    act(() => near?.(true));
    theme = "dark";
    act(() => applyThemeChoice("dark"));
    const tokyo = INDEX_PICTURES.tokyo!;
    expect(hrefsOf(container)).toEqual([
      `/pictures/${tokyo.scene.files.narrow}`,
      `/pictures/${tokyo.subject.files.narrow}`,
    ]);
    act(() => applyThemeChoice("system"));
  });

  it("says a layer is loading until its file arrives", () => {
    const { container } = render(<IndexPictureView slug="seoul" />);
    const scene = container.querySelector('rect[data-layer="scene"]')!;
    expect(scene).toHaveAttribute("data-state", "unasked");
    act(() => near?.(true));
    expect(scene).toHaveAttribute("data-state", "loading");
    fireEvent.load(container.querySelector("image")!);
    // It is drawn once it has faded in whole, which the browser's frames carry.
    expect(scene).not.toHaveAttribute("data-state", "unasked");
  });

  it("asks at once where nothing can tell when it comes near the screen", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<IndexPictureView slug="paris" />);
    expect(hrefsOf(container)[0]).toBe(`/pictures/${INDEX_PICTURES.paris!.scene.files.narrow}`);
  });
});
