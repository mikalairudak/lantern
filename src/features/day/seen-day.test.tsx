import { act, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { Day } from "./day";
import { SEEN_DAY_HEADER } from "@/lib/days/written/version";
import { isSeen, markSeen, seenKeyAt, seenKeyOf } from "./seen-days";
import { writtenDayAt } from "@/lib/days/written/days";
import { writtenVersionOf } from "@/lib/days/written/version";

const ORIGIN = "http://lantern.test";
/** Large deltas and no pauses, so a day streams in a few frames. */
const QUICK = { deltaChars: 64 };
const DAY_TIMEOUT = { timeout: 5000 };
const KANAZAWA = writtenDayAt("kanazawa")!;
const WRITTEN = {
  itinerary: KANAZAWA.itinerary,
  version: writtenVersionOf(KANAZAWA.itinerary),
  checks: {},
};
const KEY = seenKeyOf("kanazawa", WRITTEN.version);

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

const fetchDay = vi.fn((path: string, init: RequestInit) =>
  answerDayRequest(new Request(new URL(path, ORIGIN), init), QUICK),
);

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal("fetch", fetchDay);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => {
  localStorage.clear();
  fetchDay.mockClear();
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The day's own requests to the route, as the events' and the day's are told apart. */
const dayRequests = () => fetchDay.mock.calls.filter(([path]) => String(path).endsWith("/api/day"));

describe("a written day this device has seen", () => {
  it("opens whole, every stop from the first frame, with nothing asked of the route", async () => {
    markSeen(KEY);
    render(<Day first={KANAZAWA_START_REQUEST} written={WRITTEN} isAddressed />);

    // Every stop from the first frame, none let in a beat at a time.
    expect(screen.getByRole("list", { name: "The day" }).children).toHaveLength(
      KANAZAWA.itinerary.stops.length,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "A calm Saturday in Kanazawa",
    );
    const chart = screen.getByRole("group", { name: /The day's energy/ });
    await vi.waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), DAY_TIMEOUT);
    expect(dayRequests()).toHaveLength(0);
  });

  it("plays from its empty frame for a visitor who has not, and is seen once it has ended", async () => {
    render(<Day first={KANAZAWA_START_REQUEST} written={WRITTEN} isAddressed />);

    // Not yet seen as it starts: a visitor who leaves now has it played again next time.
    expect(isSeen(KEY)).toBe(false);
    await vi.waitFor(() => expect(dayRequests()).toHaveLength(1), DAY_TIMEOUT);
    const chart = await screen.findByRole("group", { name: /The day's energy/ }, DAY_TIMEOUT);
    await vi.waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), DAY_TIMEOUT);
    // Seen once its stream has ended, which a start's day closes after its last place check,
    // a moment after its last row is written.
    await vi.waitFor(() => expect(isSeen(KEY)).toBe(true), DAY_TIMEOUT);
  });

  it("stays whole when another tab clears the storage it was seen by", async () => {
    markSeen(KEY);
    render(<Day first={KANAZAWA_START_REQUEST} written={WRITTEN} isAddressed />);
    const chart = screen.getByRole("group", { name: /The day's energy/ });
    await vi.waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), DAY_TIMEOUT);

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });

    // Decided as the page first ran: nothing is asked of the route, the day stands.
    expect(dayRequests()).toHaveLength(0);
    expect(screen.getByRole("list", { name: "The day" }).children).toHaveLength(
      KANAZAWA.itinerary.stops.length,
    );
  });

  it("plays again where its build wrote it anew", async () => {
    markSeen(seenKeyOf("kanazawa", "0000000000000000"));
    render(<Day first={KANAZAWA_START_REQUEST} written={WRITTEN} isAddressed />);
    await vi.waitFor(() => expect(dayRequests()).toHaveLength(1), DAY_TIMEOUT);
  });
});

describe("a written day seen here that the page did not give", () => {
  it("is asked of the route by the version seen, and lands whole as it comes whole", async () => {
    markSeen(KEY);
    // The page gives no day whole: the route has it, and plays it whole at once.
    render(<Day first={KANAZAWA_START_REQUEST} isAddressed />);

    await vi.waitFor(() => expect(dayRequests()).toHaveLength(1), DAY_TIMEOUT);
    const [, init] = dayRequests()[0]!;
    expect(new Headers(init.headers).get(SEEN_DAY_HEADER)).toBe(KEY);
    // Asked of the page each time: the list the day lands in may be drawn anew once it comes.
    await vi.waitFor(
      () =>
        expect(screen.getByRole("list", { name: "The day" }).children).toHaveLength(
          KANAZAWA.itinerary.stops.length,
        ),
      DAY_TIMEOUT,
    );
    const chart = screen.getByRole("group", { name: /The day's energy/ });
    await vi.waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), DAY_TIMEOUT);
  });

  it("is seen once played to its end, by the version its answer said", async () => {
    render(<Day first={KANAZAWA_START_REQUEST} isAddressed />);

    const chart = await screen.findByRole("group", { name: /The day's energy/ }, DAY_TIMEOUT);
    await vi.waitFor(() => expect(chart).toHaveAttribute("aria-busy", "false"), DAY_TIMEOUT);
    // Seen once its stream has ended, after its last place check.
    await vi.waitFor(() => expect(isSeen(KEY)).toBe(true), DAY_TIMEOUT);
    expect(seenKeyAt("kanazawa")).toBe(KEY);
  });
});
