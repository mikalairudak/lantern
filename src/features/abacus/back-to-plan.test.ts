import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACK_FOCUS_WAIT_MS, waitToBringIn } from "./back-to-plan";

/** A Pixel 7's window. */
const SCREEN_PX = 839;
const PAGE_PX = 4000;
/** The energy scale's band, held at the screen's top. */
const BAND_PX = 35;
/** A slider's knob, its ring held by its scroll margins. */
const KNOB_PX = 18;
/** A frame at 60 Hz. */
const FRAME_MS = 1000 / 60;
/** What the wait and the reveal it sets off hear of the visitor. */
const TAKEN_BY = ["wheel", "touchstart", "pointerdown", "keydown"];

/** The page's scroll, every scroll asked for, and the frames waiting to be drawn. */
let scrolled = 0;
let scrolls: number[] = [];
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
let clock = 0;

/** A slider whose knob stands `top` px from the page's top, its focus ringed or not. */
function sliderAt(top: number, isRingShown = true): Element {
  const slider = document.createElementNS("http://www.w3.org/2000/svg", "g");
  slider.getBoundingClientRect = () =>
    ({ top: top - scrolled, bottom: top + KNOB_PX - scrolled }) as DOMRect;
  slider.matches = (selector: string) => selector === ":focus-visible" && isRingShown;
  document.body.append(slider);
  return slider;
}

/** Draws `count` frames, each waiting callback once a frame. */
function drawFrames(count: number): void {
  for (let index = 0; index < count; index += 1) {
    clock += FRAME_MS;
    const waiting = frames;
    frames = new Map();
    for (const callback of waiting.values()) callback(clock);
  }
}

/** Waits on `slider` as a press of "Back to the plan" does, the band held over the screen's top. */
function waitOn(slider: Element, isReducedMotion = true) {
  return waitToBringIn(slider, { isReducedMotion, coveredTopOf: () => BAND_PX });
}

/** The listeners on the window, by kind, that were added and are not yet removed. */
function listenersLeft(add: typeof addEventListener, remove: typeof removeEventListener) {
  const added = vi.mocked(add).mock.calls.filter(([kind]) => TAKEN_BY.includes(kind));
  return added.filter(
    ([kind, listener]) =>
      !vi
        .mocked(remove)
        .mock.calls.some(([removedKind, removed]) => removedKind === kind && removed === listener),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  scrolled = 0;
  scrolls = [];
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
    scrolls.push(scrolled);
    vi.stubGlobal("scrollY", scrolled);
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(nextFrame, callback);
    return nextFrame++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("the slider Back to the plan gave the focus to, once the rows rest", () => {
  it("is brought in once, its foot to the window's, where it rests past the foot with its ring", () => {
    const wait = waitOn(sliderAt(928));
    wait.rest();
    wait.rest();

    expect(scrolls).toEqual([928 + KNOB_PX - SCREEN_PX]);
  });

  it("is brought down clear of the held band where it rests under it", () => {
    scrolled = 1000;
    vi.stubGlobal("scrollY", scrolled);
    waitOn(sliderAt(1020)).rest();

    expect(scrolls).toEqual([1020 - BAND_PX]);
  });

  it("leaves the page where it is while it lies wholly in the window", () => {
    waitOn(sliderAt(BAND_PX + 400)).rest();

    expect(scrolls).toEqual([]);
  });

  it("leaves the page where it is while its focus shows no ring, as after a pointer's press alone", () => {
    waitOn(sliderAt(928, false)).rest();

    expect(scrolls).toEqual([]);
  });

  it("is weighed once the wait's cap has passed, where the rows have not come to rest", () => {
    waitOn(sliderAt(928));
    vi.advanceTimersByTime(BACK_FOCUS_WAIT_MS - 1);
    expect(scrolls).toEqual([]);
    vi.advanceTimersByTime(1);

    expect(scrolls).toEqual([928 + KNOB_PX - SCREEN_PX]);
  });
});

describe("the wait for the rows to rest", () => {
  it.each(TAKEN_BY)("ends at a %s before the rows rest, and nothing scrolls", (kind) => {
    const slider = sliderAt(928);
    const wait = waitOn(slider);
    slider.dispatchEvent(new Event(kind, { bubbles: true }));
    wait.rest();
    vi.advanceTimersByTime(BACK_FOCUS_WAIT_MS);

    expect(scrolls).toEqual([]);
  });

  it("leaves no listener on the page once the cap has passed, nor once it has brought the slider in", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    waitOn(sliderAt(BAND_PX + 400));
    expect(listenersLeft(add, remove)).not.toEqual([]);
    vi.advanceTimersByTime(BACK_FOCUS_WAIT_MS);
    expect(listenersLeft(add, remove)).toEqual([]);

    waitOn(sliderAt(928)).rest();
    expect(scrolls).toHaveLength(1);
    expect(listenersLeft(add, remove)).toEqual([]);
  });

  it("is let go with a key pressed while the slider comes in, the page left where the key took it", () => {
    const slider = sliderAt(928);
    waitOn(slider, false).rest();
    drawFrames(10);
    const taken = scrolled;
    expect(taken).toBeGreaterThan(0);
    slider.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", bubbles: true }));
    drawFrames(60);

    expect(scrolled).toBe(taken);
  });

  it("stops the slider's reveal on its way when it is cancelled, as the chart goes", () => {
    const wait = waitOn(sliderAt(928), false);
    wait.rest();
    drawFrames(10);
    const stopped = scrolled;
    wait.cancel();
    drawFrames(60);

    expect(scrolled).toBe(stopped);
  });
});
