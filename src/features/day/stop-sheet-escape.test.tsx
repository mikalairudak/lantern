import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { TAKE_THIS_DAY } from "./day-menu";
import { DayStage } from "./day-stage";
import {
  applyDayView,
  DAY_VIEW_ATTRIBUTE,
  DAY_VIEW_STORAGE_KEY,
  type DayView,
} from "./view-choice";

/**
 * An open stop's sheet on a day's page and Escape: while the chart is on show, Escape wherever
 * the focus is folds it and leaves the focus where it is, since the sheet may lie over what the
 * focus is on; an Escape something else has answered is left to it, and a sheet behind the plan
 * takes none.
 */

const KANAZAWA: Itinerary = (() => {
  const result = normalizeDay(KANAZAWA_START_REQUEST, KANAZAWA_START_DAY.day);
  if (!result.ok) throw new Error(result.reason);
  return result.itinerary;
})();
const ignore = () => undefined;

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

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  // The visitor asks for reduced motion, as the e2e run does.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => {
  document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
  localStorage.removeItem(DAY_VIEW_STORAGE_KEY);
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderDay(): void {
  render(
    <DayStage
      request={KANAZAWA_START_REQUEST}
      partial={null}
      outcome={{ kind: "complete", itinerary: KANAZAWA }}
      isStreaming={false}
      isChosen={false}
      onPlay={ignore}
      onRetry={ignore}
    />,
  );
}

/** The day's first stop's name in the chart's list, enabled once the day is placed. */
async function firstStopName(): Promise<HTMLElement> {
  const list = await screen.findByRole("list", { name: "The day" }, { timeout: 5000 });
  const [name] = within(list).getAllByRole("button");
  if (!name) throw new Error("The day drew no stop");
  await waitFor(() => expect(name).toBeEnabled());
  return name;
}

/** Shows a view as the switch does, with no press of the pointer, which would fold the stop. */
function chooseView(view: DayView): void {
  act(() => applyDayView(view));
}

/** Opens the day's first stop, and returns its name, which says whether it is open. */
async function openTheFirstStop(): Promise<HTMLElement> {
  const name = await firstStopName();
  fireEvent.click(name, { detail: 1 });
  await screen.findByRole("region", { name: /^About / });
  expect(name).toHaveAttribute("aria-expanded", "true");
  return name;
}

/** Lets every update the press asked for land before the stop is read. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe("an open stop's sheet on a day's page", () => {
  it("folds on an Escape from outside the day, the focus left where it is", async () => {
    renderDay();
    chooseView("chart");
    await openTheFirstStop();
    const menu = screen.getByRole("button", { name: TAKE_THIS_DAY });
    act(() => menu.focus());

    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("region", { name: /^About / })).toBeNull());
    expect(menu).toHaveFocus();
  });

  it("stays open on an Escape something else has answered", async () => {
    renderDay();
    chooseView("chart");
    const name = await openTheFirstStop();
    const answerFirst = (event: KeyboardEvent) => event.preventDefault();
    document.body.addEventListener("keydown", answerFirst);

    fireEvent.keyDown(document.body, { key: "Escape" });
    document.body.removeEventListener("keydown", answerFirst);
    await settle();

    expect(name).toHaveAttribute("aria-expanded", "true");
  });

  it("takes no Escape behind the plan, and is open again with the chart", async () => {
    renderDay();
    chooseView("chart");
    const name = await openTheFirstStop();
    chooseView("read");

    fireEvent.keyDown(document.body, { key: "Escape" });
    await settle();
    chooseView("chart");

    expect(name).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: /^About / })).toBeInTheDocument();
  });
});
