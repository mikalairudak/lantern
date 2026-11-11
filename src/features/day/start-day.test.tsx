import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { StartDay } from "./start-day";
import { INDEX_LABEL } from "./start-index";
import { writtenPool } from "./written-pool";

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };

/** jsdom has no layout, so the chart's container reports a laptop-sized box. */
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
    vi.fn((path: string, init: RequestInit) =>
      answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 }),
    ),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
// The start screen names the day it opens in the address, which outlives a test.
afterEach(() => window.history.replaceState(null, "", "/"));
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StartDay", () => {
  it("asks one question over the quick starts, with no day, with live generation off", () => {
    render(<StartDay pool={writtenPool()} isLive={false} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "One day in a city, planned hour by hour",
    );
    expect(screen.getByRole("textbox", { name: "Where, and anything else" })).toBeVisible();
    expect(screen.getByText("Lantern isn't writing new days right now.")).toBeVisible();
    expect(
      within(screen.getByRole("list", { name: INDEX_LABEL })).getAllByRole("button"),
    ).toHaveLength(6);
    expect(screen.queryByRole("list", { name: "The day" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /The day's energy/ })).not.toBeInTheDocument();
  });

  it("writes a start's day where the question was when it is pressed, at its address", async () => {
    const user = userEvent.setup();
    render(<StartDay pool={writtenPool()} isLive={false} />);

    await user.click(screen.getByRole("button", { name: /^Nafplio / }));

    await waitFor(
      () =>
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "A quiet Saturday in Nafplio",
        ),
      DAY_TIMEOUT,
    );
    expect(window.location.pathname).toBe("/day/nafplio");
  });

  it("reads the visitor's text with the stand-in, and writes a written city's day at its address", async () => {
    const user = userEvent.setup();
    render(<StartDay pool={writtenPool()} isLive={false} />);

    await user.type(screen.getByRole("textbox", { name: "Where, and anything else" }), "Bologna");
    await user.click(screen.getByRole("button", { name: "Plan this day" }));

    await waitFor(
      () =>
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "A lively Saturday in Bologna",
        ),
      DAY_TIMEOUT,
    );
    expect(window.location.pathname).toBe("/day/bologna");
  });

  it("never says Reading for a reading that answers at once, as the stand-in does", async () => {
    const user = userEvent.setup();
    render(<StartDay pool={writtenPool()} isLive={false} />);
    const said = new Set<string>();
    // Every text the page put up or took down, so a word shown for one render still counts,
    // and every word the button showed: its words share one cell, the unshown ones hidden.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target;
        if (record.type === "attributes" && target instanceof Element) {
          if (!target.hasAttribute("aria-hidden")) said.add(target.textContent ?? "");
          continue;
        }
        if (record.oldValue) said.add(record.oldValue);
        for (const node of [...record.addedNodes, ...record.removedNodes]) {
          said.add(node.textContent ?? "");
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      attributes: true,
      attributeFilter: ["aria-hidden"],
    });

    await user.type(screen.getByRole("textbox", { name: "Where, and anything else" }), "Bologna");
    await user.click(screen.getByRole("button", { name: "Plan this day" }));
    await waitFor(
      () =>
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "A lively Saturday in Bologna",
        ),
      DAY_TIMEOUT,
    );
    observer.disconnect();

    expect(said).not.toContain("Reading");
  });

  it("refuses to land without a written day", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<StartDay pool={[]} isLive={false} />)).toThrow(/no written day to offer/);
  });
});
