import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import { REPAIRED_DAY } from "@/lib/fixtures/edge/repaired";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { GeneratedDay } from "@/lib/schema/itinerary.schema";
import { simulateDayStream } from "@/lib/stream/simulate-day-stream";
import { Day } from "./day";

/** A day takes 6 to 9 s whole here alone, and several times that beside a full run under load. */
const DAY_TIMEOUT_MS = 60_000;
/** Few deltas, since jsdom draws the whole day at each, and still a day written for a while. */
const PACE = { deltaChars: 120, deltaDelayMs: 4 };
/** A day written whole at that pace, its rows landing a beat apart, and the press in it. */
const TEST_TIMEOUT_MS = 120_000;

/** The day the route answers with in the current test; the repaired day when none is set. */
const streamed = vi.hoisted(() => ({ day: null as GeneratedDay | null }));

/**
 * Lisbon's day with its second stop out of order, starting with the first: the finished day
 * drops it, so every stop under it moves up one place in the itinerary.
 */
function lisbonDroppingItsSecond(): GeneratedDay {
  const day = structuredClone(LISBON_DAY.day);
  const [first, second] = day.stops;
  if (!first || !second) throw new Error("Lisbon has no second stop");
  second.startTime = first.startTime;
  return day;
}

/** jsdom has no layout, so the day measures a laptop's sheet. */
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
    vi.fn(async (_path: string, init: RequestInit) =>
      simulateDayStream({
        day: streamed.day ?? REPAIRED_DAY.day,
        ending: { kind: "finished" },
        pace: PACE,
        signal: init.signal ?? undefined,
      }),
    ),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => {
  streamed.day = null;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The finished day as the normalizer makes it, whose repairs these tests meet mid-stream. */
function finished(day: GeneratedDay = REPAIRED_DAY.day) {
  const result = normalizeDay(REPAIRED_DAY.request, day);
  if (!result.ok) throw new Error(result.reason);
  return result;
}

// A day the normalizer repairs as it completes (in nine of twelve live days), opened while it
// is still written: a sheet never says what the finished day changes.
describe("a stop opened while its day is written, on a day the normalizer repairs", () => {
  it(
    "stays the stop open once a stop above it is dropped",
    async () => {
      const day = lisbonDroppingItsSecond();
      streamed.day = day;
      expect(finished(day).repairs).toEqual([
        expect.objectContaining({ kind: "dropped-stop", path: ["stops", 1] }),
      ]);
      const name = day.stops[2]?.place.name ?? "";
      const user = userEvent.setup();
      // Lisbon's is no written day: a live one, as the days the normalizer repairs are.
      render(<Day first={REPAIRED_DAY.request} isLive />);

      const list = await screen.findByRole(
        "list",
        { name: "The day" },
        { timeout: DAY_TIMEOUT_MS },
      );
      const third = await within(list).findByRole(
        "button",
        { name: new RegExp(`^${name}`) },
        { timeout: DAY_TIMEOUT_MS },
      );
      await waitFor(() => expect(third).toBeEnabled(), { timeout: DAY_TIMEOUT_MS });
      const chart = screen.getByRole("group", { name: /The day's energy/ });
      expect(chart).toHaveAttribute("aria-busy", "true");
      await user.click(third);
      const about = new RegExp(`^About ${name}`);
      expect(screen.getByRole("region", { name: /^About / })).toHaveAccessibleName(about);

      await waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), {
        timeout: DAY_TIMEOUT_MS,
      });
      expect(screen.getByRole("region", { name: /^About / })).toHaveAccessibleName(about);
      const open = within(list)
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-expanded") === "true");
      expect(open.map((button) => button.textContent)).toEqual([
        expect.stringMatching(new RegExp(`^${name}`)),
      ]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "opens a stop the finished day cuts short only once it is complete, at its final hours",
    async () => {
      const curry = finished().itinerary.stops.find(
        ({ primary }) => primary.name === "Curry on Rua do Benformoso",
      );
      if (!curry) throw new Error("No curry in the finished day");
      expect(finished().repairs).toContainEqual(
        expect.objectContaining({ kind: "shortened-overlap" }),
      );
      const user = userEvent.setup();
      // Lisbon's is no written day: a live one, as the days the normalizer repairs are.
      render(<Day first={REPAIRED_DAY.request} isLive />);

      const list = await screen.findByRole(
        "list",
        { name: "The day" },
        { timeout: DAY_TIMEOUT_MS },
      );
      const button = await within(list).findByRole(
        "button",
        { name: /^Curry on Rua do Benformoso/ },
        { timeout: DAY_TIMEOUT_MS },
      );
      const chart = screen.getByRole("group", { name: /The day's energy/ });
      // Shut while the day is written, however much has arrived after it.
      await waitFor(() => expect(within(list).getAllByRole("button").length).toBeGreaterThan(3), {
        timeout: DAY_TIMEOUT_MS,
      });
      expect(chart).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
      // The line under the chart says the day is still being written.
      const credit = screen.getByRole("link", { name: "© OpenStreetMap contributors" });
      expect(screen.getByText(/^Writing /)).toBeInTheDocument();
      // The day's end waits for the day to be whole.
      expect(screen.queryByText(/^Home by/)).toBeNull();

      await waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), {
        timeout: DAY_TIMEOUT_MS,
      });
      // Once written, the day's end takes the line's place, and nothing says how long it took.
      expect(await screen.findByText(/^Home by/)).toBeInTheDocument();
      expect(screen.queryByText(/^Writing /)).toBeNull();
      expect(credit.closest("p")).toHaveTextContent(/^© OpenStreetMap contributors/);
      await user.click(button);
      expect(screen.getByRole("region", { name: /^About Curry/ })).toHaveTextContent(
        /13:05–15:00 · 1 h 55 min/,
      );
      expect(curry.durationMinutes).toBe(115);
    },
    TEST_TIMEOUT_MS,
  );
});
