import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createGlideGroup, farthestShiftOf, GlidingHeight } from "./gliding-height";

const motionMock = vi.hoisted(() => ({
  isReduced: false,
  animate: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  // Motion's own glides, watched for what each sets off with.
  motionMock.animate.mockImplementation(actual.animate as (...args: unknown[]) => unknown);
  return {
    ...actual,
    animate: motionMock.animate,
    useReducedMotion: () => motionMock.isReduced,
  };
});

/** A reach as a row's: a glide past it takes proportionally longer. */
const ROW_REACH = 28;
/** Less than this, in px a second, is a glide that stands still. */
const MOVING_PX_A_SECOND = 50;

/** What the last glide set off with: its pace in px a second, and its spring. */
function lastSetOff(): { velocity?: number; stiffness?: number; visualDuration?: number } {
  return (motionMock.animate.mock.calls.at(-1)?.[2] ?? {}) as ReturnType<typeof lastSetOff>;
}

/** How tall the words inside the box are; jsdom lays nothing out, so the box says it. */
let wordsHeight = 0;

class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", SilentObserver);
  // A box is as tall as its words, or as its floor while that is taller.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const floor = Number.parseFloat(this.style.minHeight) || 0;
    return { height: Math.max(floor, wordsHeight) } as DOMRect;
  });
});
afterEach(() => {
  motionMock.isReduced = false;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderHeld(floor: number, words: number) {
  wordsHeight = words;
  const onGlide = vi.fn<(isGliding: boolean) => void>();
  const view = render(
    <GlidingHeight minHeight={floor} onGlide={onGlide}>
      words
    </GlidingHeight>,
  );
  const lift = () =>
    view.rerender(
      <GlidingHeight minHeight={undefined} onGlide={onGlide}>
        words
      </GlidingHeight>,
    );
  const box = () => view.container.firstChild as HTMLElement;
  return { onGlide, lift, box };
}

describe("GlidingHeight", () => {
  it("holds its floor, and rests at once when lifted over words as tall", () => {
    const { onGlide, lift } = renderHeld(300, 320);
    expect(onGlide).not.toHaveBeenCalled();

    lift();

    expect(onGlide.mock.calls).toEqual([[false]]);
  });

  it("glides down to its words when the floor is lifted, then rests", async () => {
    const { onGlide, lift } = renderHeld(300, 200);

    lift();

    expect(onGlide).toHaveBeenLastCalledWith(true);
    await waitFor(() => expect(onGlide).toHaveBeenLastCalledWith(false), { timeout: 3000 });
  });

  it("with reduced motion, steps in one frame and rests once that frame is drawn", async () => {
    motionMock.isReduced = true;
    const { onGlide, lift, box } = renderHeld(300, 200);

    lift();

    // Drawn at once, in the frame its words changed, before Motion's next frame.
    expect(box().style.height).toBe("200px");
    expect(onGlide.mock.calls).toEqual([[true]]);
    await waitFor(() => expect(onGlide.mock.calls).toEqual([[true], [false]]));
  });

  it("told to take its heights at once, steps in one frame and clips nothing meanwhile", async () => {
    wordsHeight = 300;
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const box = (floor: number | undefined) => (
      <GlidingHeight minHeight={floor} onGlide={onGlide} isClippedWhileGliding isInstant>
        words
      </GlidingHeight>
    );
    const view = render(box(300));
    wordsHeight = 200;

    view.rerender(box(undefined));

    const drawn = view.container.firstChild as HTMLElement;
    // Drawn at once, as under reduced motion, but never marked to clip what moves inside it.
    expect(drawn.style.height).toBe("200px");
    expect(drawn).toHaveClass("data-gliding:not-panel-open:overflow-y-clip");
    expect(drawn).not.toHaveAttribute("data-gliding");
    expect(onGlide.mock.calls).toEqual([[true]]);
    await waitFor(() => expect(onGlide.mock.calls).toEqual([[true], [false]]));
  });

  it("starts gliding in the commit its words grew, before an observer could report them", () => {
    wordsHeight = 100;
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const box = (words: string) => (
      <GlidingHeight onGlide={onGlide} isClippedWhileGliding>
        {words}
      </GlidingHeight>
    );
    const view = render(box("a line"));
    wordsHeight = 140;

    view.rerender(box("a line and a word that wraps"));

    // This observer never reports, as a real one has not yet in the commit: the render's own
    // measure starts the glide, so what waits on it is told before any timer can run.
    expect(onGlide.mock.calls).toEqual([[true]]);
    expect(view.container.firstChild).toHaveAttribute("data-gliding");
  });

  it("goes on at the pace it has when its words grow again mid-glide, never from rest", async () => {
    wordsHeight = 100;
    const box = (words: string) => <GlidingHeight>{words}</GlidingHeight>;
    const view = render(box("a line"));
    const drawn = view.container.firstChild as HTMLElement;
    wordsHeight = 200;
    view.rerender(box("a line and a second"));
    // A glide from rest sets off from rest.
    expect(lastSetOff().velocity).toBe(0);
    await waitFor(() => {
      const height = Number.parseFloat(drawn.style.height);
      expect(height).toBeGreaterThan(120);
      expect(height).toBeLessThan(180);
    });

    wordsHeight = 300;
    view.rerender(box("a line, a second and a third"));

    // Set off again from rest, a header growing over a stream's first deltas stalled mid-way.
    expect(lastSetOff().velocity).toBeGreaterThan(MOVING_PX_A_SECOND);
    // On a spring set by its physics: Motion gives one set by its time no pace.
    expect(lastSetOff().stiffness).toBeGreaterThan(0);
    expect(lastSetOff()).not.toHaveProperty("visualDuration");
  });

  it("on its reach, sets off again from rest when its words grow mid-glide", async () => {
    wordsHeight = 100;
    const box = (words: string) => (
      <GlidingHeight reachPx={ROW_REACH} shouldAlwaysReach>
        {words}
      </GlidingHeight>
    );
    const view = render(box("a line"));
    const drawn = view.container.firstChild as HTMLElement;
    wordsHeight = 200;
    view.rerender(box("a line and a second"));
    await waitFor(() => expect(Number.parseFloat(drawn.style.height)).toBeGreaterThan(110));

    wordsHeight = 300;
    view.rerender(box("a line, a second and a third"));

    // Carried on, a re-plan's header room moved the rows under it faster than a row reads.
    expect(lastSetOff().velocity).toBe(0);
  });

  it("sets off from rest when its words shrink back mid-glide, never carried past", async () => {
    wordsHeight = 100;
    const box = (words: string) => <GlidingHeight>{words}</GlidingHeight>;
    const view = render(box("a line"));
    const drawn = view.container.firstChild as HTMLElement;
    wordsHeight = 300;
    view.rerender(box("a line, a second and a third"));
    await waitFor(() => {
      const height = Number.parseFloat(drawn.style.height);
      expect(height).toBeGreaterThan(150);
      expect(height).toBeLessThan(250);
    });

    wordsHeight = 100;
    view.rerender(box("a line"));

    expect(lastSetOff().velocity).toBe(0);
  });

  it("taking another box's place, sets off from its height and glides to its words", async () => {
    wordsHeight = 330;
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const { container } = render(
      <GlidingHeight fromHeight={300} onGlide={onGlide}>
        words
      </GlidingHeight>,
    );

    // Its first height is not taken at once: it glides there, from the box it took the
    // place of, and rests at its words.
    expect(onGlide.mock.calls).toEqual([[true]]);
    await waitFor(() => expect(onGlide).toHaveBeenLastCalledWith(false), { timeout: 3000 });
    expect((container.firstChild as HTMLElement).style.height).toBe("330px");
  });

  it("taking the place of a box as tall, takes its height at once", async () => {
    wordsHeight = 300;
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const { container } = render(
      <GlidingHeight fromHeight={300} onGlide={onGlide}>
        words
      </GlidingHeight>,
    );

    await waitFor(() =>
      expect((container.firstChild as HTMLElement | null)?.style.height).toBe("300px"),
    );
    expect(onGlide).not.toHaveBeenCalled();
  });

  it("takes its first height at once, with no glide", async () => {
    wordsHeight = 200;
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const { container } = render(<GlidingHeight onGlide={onGlide}>words</GlidingHeight>);

    await waitFor(() =>
      expect((container.firstChild as HTMLElement | null)?.style.height).toBe("200px"),
    );
    expect(onGlide).not.toHaveBeenCalled();
  });

  it("takes its first height once when strict mode runs its effects twice", async () => {
    wordsHeight = 200;
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const { container } = render(
      <StrictMode>
        <GlidingHeight onGlide={onGlide}>words</GlidingHeight>
      </StrictMode>,
    );

    // The second run goes on from the height the first one drew, so nothing glides; it may
    // say once that the box is at rest.
    await waitFor(() =>
      expect((container.firstChild as HTMLElement | null)?.style.height).toBe("200px"),
    );
    expect(onGlide).not.toHaveBeenCalledWith(true);
  });

  it("goes on from the height it drew when reduced motion is switched, with no glide", async () => {
    const { onGlide, lift, box } = renderHeld(300, 200);
    lift();
    await waitFor(() => expect(onGlide).toHaveBeenLastCalledWith(false), { timeout: 3000 });
    onGlide.mockClear();

    motionMock.isReduced = true;
    lift();

    expect(onGlide).not.toHaveBeenCalled();
    expect(box().style.height).toBe("200px");
  });

  it("clips what stands taller than it only while it glides, never at rest", async () => {
    wordsHeight = 200;
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const box = (floor: number | undefined) => (
      <GlidingHeight minHeight={floor} onGlide={onGlide} isClippedWhileGliding>
        words
      </GlidingHeight>
    );
    const view = render(box(300));
    const drawn = view.container.firstChild as HTMLElement;
    expect(drawn).not.toHaveAttribute("data-gliding");

    view.rerender(box(undefined));

    expect(drawn).toHaveClass("data-gliding:not-panel-open:overflow-y-clip");
    expect(drawn).toHaveAttribute("data-gliding");
    await waitFor(() => expect(onGlide).toHaveBeenLastCalledWith(false), { timeout: 3000 });
    expect(drawn).not.toHaveAttribute("data-gliding");
  });

  it("clips nothing unless asked, gliding or not", () => {
    const { lift, box } = renderHeld(300, 200);

    lift();

    expect(box()).not.toHaveClass("data-gliding:not-panel-open:overflow-y-clip");
  });
});

describe("glides that set off together", () => {
  /** The next animation frame and the one after, by when Motion has run its steps. */
  const nextFrames = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  it("are timed by the farthest they move what stands under them, rows down the page", async () => {
    const group = createGlideGroup();
    // Joined out of order: the row at 300 shrinks by 25 under one at 100 that grew by 40.
    const lower = group.join(-25, 300);
    const upper = group.join(40, 100);
    expect(lower()).toEqual({ count: 2, farthestPx: 40 });
    expect(upper()).toEqual({ count: 2, farthestPx: 40 });

    // A frame on, the next glide is a new group's, alone.
    await nextFrames();
    expect(group.join(10, 0)()).toEqual({ count: 1, farthestPx: 10 });
  });

  it("move what is under them by every glide above, so rows shrinking together add up", () => {
    // Kyoto's list going lively on a phone: the rows under the first shrink.
    const shrinking = [-23, -23, -28, -23, 0, -99, -99, -35].map((distance, at) => ({
      distance,
      top: at * 200,
    }));
    expect(farthestShiftOf(shrinking)).toBe(330);
    expect(
      farthestShiftOf([
        { distance: 30, top: 0 },
        { distance: -30, top: 200 },
      ]),
    ).toBe(30);
    expect(farthestShiftOf([])).toBe(0);
  });

  it("sets off a glide in a group on the next frame, and comes to rest", async () => {
    wordsHeight = 100;
    const onGlide = vi.fn<(isGliding: boolean) => void>();
    const group = createGlideGroup();
    const box = () => (
      <GlidingHeight reachPx={28} shouldAlwaysReach glideGroup={group} onGlide={onGlide}>
        words
      </GlidingHeight>
    );
    const view = render(box());

    wordsHeight = 160;
    view.rerender(box());

    expect(onGlide).toHaveBeenLastCalledWith(true);
    await waitFor(() => expect(onGlide).toHaveBeenLastCalledWith(false), { timeout: 5000 });
  });
});

describe("a box that holds the view", () => {
  /** Where the box's top stands on screen before the page scrolls: above it, or on it. */
  let boxTop = 0;
  let scrolled = 0;
  let heldBox: Element | null = null;

  beforeAll(() => {
    // The box ends where its own height says, from its top, as the page has scrolled.
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (
      this: HTMLElement,
    ) {
      const floor = Number.parseFloat(this.style.minHeight) || 0;
      const own = Number.parseFloat(this.style.height);
      const height = this === heldBox && !Number.isNaN(own) ? own : Math.max(floor, wordsHeight);
      return { height, bottom: boxTop + height - scrolled } as DOMRect;
    });
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrolled });
    vi.spyOn(window, "scrollBy").mockImplementation(((_x: number, y: number) => {
      scrolled += Math.round(y);
    }) as typeof window.scrollBy);
  });

  /** Two frames on: Motion has drawn what it was given. */
  const twoFrames = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  async function renderHolding(top: number, isViewHeldOnScreen = false) {
    boxTop = top;
    scrolled = 0;
    wordsHeight = 100;
    motionMock.isReduced = true;
    const words = (text: string) => (
      <GlidingHeight shouldHoldTheView isViewHeldOnScreen={isViewHeldOnScreen}>
        <p>{text}</p>
      </GlidingHeight>
    );
    const view = render(words("a line"));
    heldBox = view.container.firstElementChild;
    await twoFrames();
    const grow = (by: number) => {
      wordsHeight += by;
      view.rerender(words(`a line and ${by} px more`));
    };
    return { grow };
  }

  it("scrolls the page by its growth while it stands above the screen", async () => {
    const { grow } = await renderHolding(-400);

    grow(30);

    await waitFor(() => expect(scrolled).toBe(30));
  });

  it("leaves the page where it is when it reaches into the screen", async () => {
    const { grow } = await renderHolding(40);

    grow(30);

    await twoFrames();
    expect(scrolled).toBe(0);
  });

  it("scrolls by its growth on the screen too while a hand acts below it", async () => {
    const { grow } = await renderHolding(40, true);

    grow(30);

    await waitFor(() => expect(scrolled).toBe(30));
  });
});
