import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REVEAL_STEP_PX } from "@/lib/tokens/motion";
import { isRevealing, revealInView, scrollToPlace } from "./reveal-in-view";

const SCREEN_PX = 800;
const PAGE_PX = 4000;
/** A frame at 60 Hz. */
const FRAME_MS = 1000 / 60;

/** The page's scroll and the frames waiting to be drawn; jsdom lays nothing out. */
let scrolled = 0;
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
let clock = 0;

/** An element whose box stands `top` px from the page's top, `height` tall. */
function elementAt(top: number, height: number): HTMLElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () =>
    ({ top: top - scrolled, bottom: top + height - scrolled }) as DOMRect;
  document.body.append(element);
  return element;
}

/** Draws one frame `ms` after the last: each waiting callback runs once. */
function drawFrame(ms = FRAME_MS): void {
  clock += ms;
  const waiting = frames;
  frames = new Map();
  for (const callback of waiting.values()) callback(clock);
}

/** Every scroll the frames make, until the reveal has come to rest. */
function scrollsUntilRest(ms = FRAME_MS): number[] {
  const seen = [scrolled];
  for (let frame = 0; frame < 600 && isRevealing(); frame += 1) {
    drawFrame(ms);
    seen.push(scrolled);
  }
  return seen;
}

beforeEach(() => {
  scrolled = 0;
  frames = new Map();
  clock = 0;
  vi.stubGlobal("innerHeight", SCREEN_PX);
  vi.stubGlobal("scrollY", 0);
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: PAGE_PX,
  });
  vi.stubGlobal("scrollTo", ({ top }: ScrollToOptions) => {
    scrolled = top ?? scrolled;
    vi.stubGlobal("scrollY", scrolled);
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(nextFrame, callback);
    return nextFrame++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("revealInView", () => {
  it("leaves the page where it is when the element is in view", () => {
    revealInView(elementAt(200, 300), false);

    expect(isRevealing()).toBe(false);
    expect(scrolled).toBe(0);
  });

  it("brings an element below the screen up until its foot is the screen's, on the spring, no frame further than its step", () => {
    revealInView(elementAt(900, 400), false);
    const scrolls = scrollsUntilRest();

    expect(scrolled).toBeCloseTo(500, 0);
    const steps = scrolls.slice(1).map((scroll, at) => scroll - (scrolls[at] ?? 0));
    expect(Math.max(...steps)).toBeLessThanOrEqual(REVEAL_STEP_PX);
    expect(steps.every((step) => step >= 0)).toBe(true);
  });

  it("catches up over the next frames after a frame drawn late, rather than jumping", () => {
    revealInView(elementAt(900, 400), false);
    drawFrame();
    drawFrame(200);

    expect(scrolled).toBeLessThanOrEqual(REVEAL_STEP_PX * 2);
    scrollsUntilRest();
    expect(scrolled).toBeCloseTo(500, 0);
  });

  it("goes where the element stands each frame, so what grows above it on the way is in its way", () => {
    let top = 900;
    const element = elementAt(0, 400);
    element.getBoundingClientRect = () =>
      ({ top: top - scrolled, bottom: top + 400 - scrolled }) as DOMRect;
    revealInView(element, false);
    drawFrame();
    top += 54;
    scrollsUntilRest();

    expect(scrolled).toBeCloseTo(554, 0);
  });

  it("brings an element above the screen down to its top", () => {
    scrolled = 1000;
    vi.stubGlobal("scrollY", scrolled);
    revealInView(elementAt(600, 200), false);
    scrollsUntilRest();

    expect(scrolled).toBeCloseTo(600, 0);
  });

  it("holds the browser's own scroll anchoring off while it scrolls, and gives it back", () => {
    document.documentElement.style.overflowAnchor = "auto";
    revealInView(elementAt(900, 400), false);

    expect(document.documentElement.style.overflowAnchor).toBe("none");
    scrollsUntilRest();
    expect(document.documentElement.style.overflowAnchor).toBe("auto");
  });

  it("goes at once with reduced motion", () => {
    revealInView(elementAt(900, 400), true);

    expect(isRevealing()).toBe(false);
    expect(scrolled).toBe(500);
  });

  it("gives the page back to the visitor's wheel", () => {
    revealInView(elementAt(900, 400), false);
    drawFrame();
    const before = scrolled;
    window.dispatchEvent(new Event("wheel"));
    drawFrame();

    expect(isRevealing()).toBe(false);
    expect(scrolled).toBe(before);
  });

  it("stops the reveal on its way when another starts", () => {
    revealInView(elementAt(900, 400), false);
    drawFrame();
    const stop = revealInView(elementAt(1600, 200), false);
    scrollsUntilRest();

    expect(scrolled).toBeCloseTo(1000, 0);
    stop();
    expect(isRevealing()).toBe(false);
  });
});

/** An element whose box stands where `place` says each time it is read, so a test can move it. */
function elementPlaced(place: { top: number; height: number }): HTMLElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () =>
    ({ top: place.top - scrolled, bottom: place.top + place.height - scrolled }) as DOMRect;
  document.body.append(element);
  return element;
}

/** How long a test lets a watch run before it must have stood down, in ms. */
const WATCHED_AT_MOST_MS = 2000;

describe("revealInView on an element in view", () => {
  it("watches it, scrolling nothing and leaving the view's hold be, and reveals it once growth above pushes it out", () => {
    const place = { top: 600, height: 150 };
    revealInView(elementPlaced(place), false);
    drawFrame();
    drawFrame();

    expect(isRevealing()).toBe(false);
    expect(scrolled).toBe(0);
    // A line of the header opens above it: its foot is 70 px past the screen's.
    place.top += 120;
    drawFrame();
    expect(isRevealing()).toBe(true);
    scrollsUntilRest();
    expect(scrolled).toBeCloseTo(70, 0);
  });

  it("watches it no longer than the spring takes, and leaves it where growth after that puts it", () => {
    const place = { top: 600, height: 150 };
    revealInView(elementPlaced(place), false);
    let watched = 0;
    while (frames.size > 0 && watched < WATCHED_AT_MOST_MS) {
      drawFrame();
      watched += FRAME_MS;
    }

    expect(frames.size).toBe(0);
    place.top += 120;
    drawFrame();
    expect(scrolled).toBe(0);
  });

  it("gives the watch back to the visitor's wheel", () => {
    const place = { top: 600, height: 150 };
    revealInView(elementPlaced(place), false);
    drawFrame();
    window.dispatchEvent(new Event("wheel"));
    place.top += 120;
    drawFrame();

    expect(scrolled).toBe(0);
    expect(frames.size).toBe(0);
  });

  it("leaves the browser's own scroll anchoring as it is while it only watches", () => {
    document.documentElement.style.overflowAnchor = "auto";
    revealInView(elementPlaced({ top: 600, height: 150 }), false);
    drawFrame();
    drawFrame();

    expect(document.documentElement.style.overflowAnchor).toBe("auto");
  });

  it("gives way to a second reveal, which goes alone", () => {
    const watched = { top: 600, height: 150 };
    revealInView(elementPlaced(watched), false);
    drawFrame();
    revealInView(elementAt(900, 400), false);
    // The first sheet pushed out now: its watch is over, and only the second's way is gone.
    watched.top += 120;
    scrollsUntilRest();

    expect(scrolled).toBeCloseTo(500, 0);
    expect(frames.size).toBe(0);
  });

  it("stops watching when its sheet goes, its frames and listeners with it", () => {
    const place = { top: 600, height: 150 };
    const removed = vi.spyOn(window, "removeEventListener");
    const stop = revealInView(elementPlaced(place), false);
    drawFrame();
    stop();
    place.top += 120;
    drawFrame();

    expect(frames.size).toBe(0);
    expect(scrolled).toBe(0);
    for (const kind of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      expect(removed).toHaveBeenCalledWith(kind, expect.any(Function), { capture: true });
    }
    // Its listeners gone, a wheel later reaches nothing of it.
    window.dispatchEvent(new Event("wheel"));
    expect(isRevealing()).toBe(false);
    removed.mockRestore();
  });

  it("reveals it at once with reduced motion when growth pushes it out", () => {
    const place = { top: 600, height: 150 };
    revealInView(elementPlaced(place), true);
    drawFrame();
    place.top += 120;
    drawFrame();

    expect(scrolled).toBe(70);
    expect(isRevealing()).toBe(false);
  });
});

describe("revealInView on an element that grows on its way", () => {
  it("turns to its top once it is taller than the screen, whose foot would carry its top out of view", () => {
    const place = { top: 900, height: 400 };
    revealInView(elementPlaced(place), false);
    drawFrame();
    place.height = 1000;
    scrollsUntilRest();

    expect(scrolled).toBeCloseTo(900, 0);
  });
});

describe("scrollToPlace", () => {
  it("tells the holds to stand down while its smooth scroll is on its way, until it ends", () => {
    const element = document.createElement("div");
    const scrollIntoView = vi.fn();
    element.scrollIntoView = scrollIntoView;

    scrollToPlace(element, { block: "center", behavior: "smooth" });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect(isRevealing()).toBe(true);

    window.dispatchEvent(new Event("scrollend"));
    expect(isRevealing()).toBe(false);
  });

  it("stands nothing down for a scroll that is there at once, or one the visitor takes back", () => {
    const element = document.createElement("div");
    element.scrollIntoView = vi.fn();

    scrollToPlace(element, { block: "center", behavior: "instant" });
    expect(isRevealing()).toBe(false);

    scrollToPlace(element, { block: "center", behavior: "smooth" });
    window.dispatchEvent(new Event("wheel"));
    expect(isRevealing()).toBe(false);
  });
});
