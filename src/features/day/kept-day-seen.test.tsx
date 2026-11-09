import { act, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { StoredDay } from "@/lib/days/stored-day";
import { KYOTO_REQUEST } from "@/lib/fixtures/curated/requests";
import { KYOTO_ITINERARY } from "@/lib/fixtures/replan/kyoto-morning";
import { KeptDayPage } from "./kept-day-page";
import { isKeptSeen, keptSeenKeyOf, markSeen } from "./seen-days";
import { browserStorage, keepYourDay, type YourDay } from "./your-days";

/**
 * A day kept on the server, at its own address, opened by a device that has seen it, with
 * motion (`docs/decisions.md`, "A written day's page is built whole, and plays only for a visitor
 * who has not seen it"): drawn whole at once, where its pen writes in a day from someone's link.
 * Its own file, as Motion reads the visitor's motion once for every test.
 */

const ID = "1b6f0c2e-4d3a-4f5b-9c7e-2a1d3e4f5a6b";
/** Kyoto's day as a visitor's, kept in the log: no day the site has written. */
const KYOTO = { request: KYOTO_REQUEST, itinerary: KYOTO_ITINERARY };
const STOPS = KYOTO.itinerary.stops.length;
const WRITTEN: StoredDay = {
  status: "written",
  ...KYOTO,
  checks: {},
  writtenAt: "2026-11-03T20:00:00.000Z",
  seconds: 46,
  round: 0,
};
/** Cut short with its first four stops kept. */
const KEPT_STOPS = 4;
const CUT: StoredDay = {
  ...WRITTEN,
  status: "cut",
  itinerary: { ...KYOTO.itinerary, stops: KYOTO.itinerary.stops.slice(0, KEPT_STOPS) },
};
const CHART_WIDTH = 448;
const CHART_HEIGHT = 640;
/** The pen writes a day in over a few seconds, on jsdom's frames. */
const PLAYED_TIMEOUT = { timeout: 15000 };

/** jsdom has no layout, so the chart's container reports a laptop-sized box. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: CHART_WIDTH, height: CHART_HEIGHT } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

/** The visitor has no preference about motion. */
function noPreference(query: string): MediaQueryList {
  return {
    matches: false,
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
  vi.stubGlobal("matchMedia", noPreference);
  // The page asks for nothing: the log answered as it was drawn.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("nothing is asked"))),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", `/day/${ID}`);
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

/** This browser's own record of the day: asked here, and how it stood when last told. */
function writtenHere(ending: YourDay["ending"]): void {
  keepYourDay(browserStorage(), {
    id: ID,
    request: KYOTO.request,
    startedAt: "2026-11-03T19:59:00.000Z",
    energies: [],
    ending,
    seconds: ending === "writing" ? null : 46,
  });
}

/** The day's rows on the chart, as many as are drawn. */
function rows(): number {
  const list = screen.queryByRole("list", { name: "The day" });
  return list ? within(list).queryAllByRole("listitem").length : 0;
}

function chart(): HTMLElement {
  return screen.getByRole("group", { name: /The day's energy/ });
}

describe("a kept day this device has seen", () => {
  it("opens whole a day watched to its end here, every row at once", () => {
    markSeen(keptSeenKeyOf(ID));
    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);

    expect(rows()).toBe(STOPS);
  });

  it("writes in a day the list holds as written that no one watched to its end here", () => {
    // The start screen and the day's page tell the list how a day ended, from the log.
    writtenHere("written");
    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);

    expect(rows()).toBe(0);
  });

  it("is drawn by the server as the pen's first frame, then whole as the page hydrates", async () => {
    markSeen(keptSeenKeyOf(ID));
    const page = <KeptDayPage id={ID} stored={WRITTEN} isLive={false} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.append(container);
    // Gone whatever the test finds, so no other test reads this page's day.
    onTestFinished(() => container.remove());
    // The server knows nothing of what this browser has seen.
    expect(container.querySelectorAll('ol[aria-label="The day"] > li')).toHaveLength(0);

    const root = await act(async () => hydrateRoot(container, page));
    onTestFinished(() => act(() => root.unmount()));

    expect(container.querySelectorAll('ol[aria-label="The day"] > li')).toHaveLength(STOPS);
  });

  it("writes in with its pen a day from someone's link, its rows after", async () => {
    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);

    expect(rows()).toBe(0);
    await waitFor(() => expect(rows()).toBe(STOPS), PLAYED_TIMEOUT);
  });

  it("never counts as seen a day from someone's link left before its end", () => {
    const view = render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);
    expect(rows()).toBe(0);
    view.unmount();

    expect(isKeptSeen(ID)).toBe(false);
  });

  it("writes in a day this browser left while it was written", () => {
    writtenHere("writing");
    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);

    expect(rows()).toBe(0);
  });

  it("opens whole next time a day from someone's link watched to its end here", async () => {
    const view = render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);
    expect(isKeptSeen(ID)).toBe(false);
    await waitFor(() => expect(chart()).toHaveAttribute("aria-busy", "false"), PLAYED_TIMEOUT);
    await waitFor(() => expect(isKeptSeen(ID)).toBe(true), PLAYED_TIMEOUT);
    view.unmount();

    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);

    expect(rows()).toBe(STOPS);
  });

  it("keeps a day drawn whole when another tab clears the storage it was seen by", () => {
    markSeen(keptSeenKeyOf(ID));
    render(<KeptDayPage id={ID} stored={WRITTEN} isLive={false} />);
    expect(rows()).toBe(STOPS);

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });

    expect(rows()).toBe(STOPS);
  });

  it("opens whole a day cut short and watched here, with the stops it kept", () => {
    markSeen(keptSeenKeyOf(ID));
    render(<KeptDayPage id={ID} stored={CUT} isLive={false} />);

    expect(rows()).toBe(KEPT_STOPS);
  });

  it("says whole, at once, why a day watched here did not finish", () => {
    markSeen(keptSeenKeyOf(ID));
    render(
      <KeptDayPage id={ID} stored={{ status: "failed", request: KYOTO.request }} isLive={false} />,
    );

    const notice = document.querySelector<HTMLElement>("header p.text-quote");
    expect(notice).not.toBeNull();
    // Written in by its pen, a notice's letters to come stand unseen.
    expect(notice?.querySelector(".opacity-0")).toBeNull();
  });
});
