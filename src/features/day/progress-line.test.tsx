import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NEVER_QUIET_DAY } from "@/lib/fixtures/edge/edge-days";
import { dayText, simulateDayStream, type StreamEnding } from "@/lib/stream/simulate-day-stream";
import { Day } from "./day";
import { TAKE_THIS_DAY } from "./day-menu";

/** A day takes some seconds whole in jsdom alone, and several times that under load. */
const DAY_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 120_000;
/** Long enough for any effect after the day's end to have run. */
const SETTLE_MS = 300;
/** Few deltas, since jsdom draws the whole day at each. */
const PACE = { deltaChars: 120, deltaDelayMs: 4 };

/** How the stream the route answers with ends, in the current test. */
const streamed = vi.hoisted(() => ({ ending: { kind: "finished" } as StreamEnding }));

/** jsdom has no layout, so the day measures a laptop's column. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: 448, height: 640 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

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
    vi.fn(async (path: string, init: RequestInit) =>
      // The day's route answers with the day; the product's events are taken and forgotten.
      String(path).includes("/api/day")
        ? simulateDayStream({
            day: NEVER_QUIET_DAY.day,
            ending: streamed.ending,
            pace: PACE,
            signal: init.signal ?? undefined,
          })
        : new Response(null, { status: 204 }),
    ),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => {
  streamed.ending = { kind: "finished" };
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The line under the chart: the paragraph its OpenStreetMap credit stands in. */
function sourcesLine(): HTMLElement | null {
  return screen.queryByRole("link", { name: "© OpenStreetMap contributors" })?.closest("p") ?? null;
}

/** Waits for the day to be written, as far as its stream goes, and usable. */
async function theDayEnds(): Promise<void> {
  const chart = await screen.findByRole(
    "group",
    { name: /The day's energy/ },
    { timeout: DAY_TIMEOUT_MS },
  );
  await waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), {
    timeout: DAY_TIMEOUT_MS,
  });
}

describe("the line under a live day's chart", () => {
  it(
    "gives its place to the day's end once the day is whole: no time, its sources after",
    async () => {
      render(<Day first={NEVER_QUIET_DAY.request} isLive />);

      await theDayEnds();
      await screen.findByText(/^Home by midnight/, undefined, { timeout: DAY_TIMEOUT_MS });
      expect(sourcesLine()).toHaveTextContent(/^© OpenStreetMap contributors/);
      expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "ends the chart's day too, under its last row",
    async () => {
      document.documentElement.setAttribute("data-day-view", "chart");
      try {
        render(<Day first={NEVER_QUIET_DAY.request} isLive />);

        await theDayEnds();
        const end = await screen.findByText(/^Home by midnight/, undefined, {
          timeout: DAY_TIMEOUT_MS,
        });
        const chart = screen.getByRole("group", { name: /The day's energy/ });
        expect(chart.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      } finally {
        document.documentElement.removeAttribute("data-day-view");
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "offers a day cut short in its versions, its stops kept, only its link, and no time",
    async () => {
      const user = userEvent.setup();
      const text = dayText(NEVER_QUIET_DAY.day);
      streamed.ending = { kind: "cut", at: text.indexOf('"alternatives"') + 400, by: "length" };
      render(<Day first={NEVER_QUIET_DAY.request} isLive />);

      // Once the stream has ended with the stops it kept, the line holds its sources alone,
      // and the day's end says what the day is and asks nothing; the menu has no way to take
      // it along but its link, which a day with no address of its own has not.
      await theDayEnds();
      await screen.findByText(/^Home by midnight/, undefined, { timeout: DAY_TIMEOUT_MS });
      await new Promise((settle) => setTimeout(settle, SETTLE_MS));
      expect(sourcesLine()).toHaveTextContent(/^© OpenStreetMap contributors/);
      expect(screen.queryByRole("button", { name: "Yes" })).toBeNull();
      await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
      expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
        expect.stringMatching(/^Plan another day/),
      ]);
    },
    TEST_TIMEOUT_MS,
  );
});
