import { act, render, renderHook, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { Day } from "./day";
import { LiveFlag, useLiveNow } from "./live-flag";

const ORIGIN = "http://lantern.test";
/** Large deltas and no pauses, so a day streams in a few frames. */
const QUICK = { deltaChars: 64 };
const DAY_TIMEOUT = { timeout: 5000 };

/**
 * The page's markup once it has held still between two reads: after the chart stops being busy,
 * the rest of the page can still be settling, and a read taken then differs from the next on its
 * own, whatever the flag does.
 */
async function stillMarkup(container: HTMLElement): Promise<string> {
  let last: string | null = null;
  await vi.waitFor(
    () => {
      const now = container.innerHTML;
      const isStill = now === last;
      last = now;
      expect(isStill).toBe(true);
    },
    { ...DAY_TIMEOUT, interval: 250 },
  );
  return container.innerHTML;
}

/** jsdom has no layout, so a box reports a laptop's size. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: 448, height: 640 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

/** The visitor asks for reduced motion, as the e2e run does: only the stream takes time. */
function reducedMotion(query: string): MediaQueryList {
  return {
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string, init: RequestInit) =>
      answerDayRequest(new Request(new URL(path, ORIGIN), init), QUICK),
    ),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("whether Lantern writes new days, for a page built ahead", () => {
  it("is off in the shell, the answer once it has come, and a page's own where it gives one", () => {
    const { result, rerender } = renderHook(({ given }: { given?: boolean }) => useLiveNow(given), {
      initialProps: {},
    });
    expect(result.current).toBe(false);

    const flag = render(<LiveFlag isLive />);
    expect(result.current).toBe(true);
    rerender({ given: false });
    expect(result.current).toBe(false);

    flag.rerender(<LiveFlag isLive={false} />);
    rerender({});
    expect(result.current).toBe(false);
  });

  it("changes nothing on a written day drawn before it came", async () => {
    const page = render(<Day first={KANAZAWA_START_REQUEST} isAddressed isCounted />);
    const chart = await screen.findByRole("group", { name: /The day's energy/ }, DAY_TIMEOUT);
    await vi.waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), DAY_TIMEOUT);
    const before = await stillMarkup(page.container);

    // The answer for this visit arrives after the day, from the page's part of its own.
    act(() => {
      page.rerender(
        <>
          <Day first={KANAZAWA_START_REQUEST} isAddressed isCounted />
          <LiveFlag isLive />
        </>,
      );
    });

    expect(page.container.innerHTML).toBe(before);
  });
});
