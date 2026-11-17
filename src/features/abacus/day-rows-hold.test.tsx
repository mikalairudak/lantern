import { render, screen, waitFor } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StopRowCell } from "./stop-row-cell";

const CELL_WIDTH = 390;
/** A proposal beside the day: its fork's rows come and go, so the chart holds its rows in view. */
const PROPOSED = { example: 0, state: "proposed", density: null } as const;
/** Where the chart's top stands on the page: above the screen, as the hold needs. */
const CHART_TOP_PX = -50;
/** How far down the page the chart moves, as something above it grows. */
const CHART_MOVED_PX = 20;
/** How long the rows are given to be placed: a pen, Motion's frames and the rows' first places take well under it. */
const SPRINGS_TIMEOUT = { timeout: 3000 };

/** Whether the lab's rows are told they are on show; left out, as a lab cell leaves it. */
const view = vi.hoisted(() => ({ isOnShow: undefined as boolean | undefined }));

vi.mock("./day-rows", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./day-rows")>();
  return {
    ...actual,
    DayRows: (props: ComponentProps<typeof actual.DayRows>) =>
      createElement(actual.DayRows, { ...props, isOnShow: view.isOnShow }),
  };
});

/** jsdom has no layout, so the cell reports a phone's width. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: CELL_WIDTH, height: 0 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

/** The page as jsdom lacks it: every box stands where the chart's top does, less the scroll. */
const page = { chartTop: 0, scrollY: 0 };
const scrollBy = vi.fn((...args: unknown[]) => {
  const [, y] = args;
  if (typeof y === "number") page.scrollY += y;
});

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.spyOn(window, "scrollBy").mockImplementation(scrollBy);
  vi.spyOn(window, "scrollY", "get").mockImplementation(() => page.scrollY);
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
afterEach(() => {
  view.isOnShow = undefined;
  page.chartTop = 0;
  page.scrollY = 0;
  scrollBy.mockClear();
});

/**
 * A proposal beside the day, its rows placed, then the chart moved down the page as its top
 * stands above the screen: what the rows do about the view.
 */
async function moveTheChartUnderTheScreen(): Promise<void> {
  const { rerender } = render(<StopRowCell {...PROPOSED} />);
  const list = await screen.findByRole("list", { name: "The day" });
  await waitFor(() => expect(list).toHaveAttribute("aria-busy", "false"), SPRINGS_TIMEOUT);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() =>
    DOMRect.fromRect({ x: 0, y: page.chartTop - page.scrollY, width: CELL_WIDTH, height: 0 }),
  );
  page.chartTop = CHART_TOP_PX;
  rerender(<StopRowCell {...PROPOSED} />);
  page.chartTop = CHART_TOP_PX + CHART_MOVED_PX;
  rerender(<StopRowCell {...PROPOSED} />);
}

describe("the rows in view while a fork's rows come and go", () => {
  it("are held on the chart on show: the page scrolls as far as the chart moved", async () => {
    view.isOnShow = true;
    await moveTheChartUnderTheScreen();
    expect(scrollBy).toHaveBeenCalledWith(0, CHART_MOVED_PX);
  });

  it("are left alone on a chart laid out unseen behind the plan: the page is the plan's", async () => {
    view.isOnShow = false;
    await moveTheChartUnderTheScreen();
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
