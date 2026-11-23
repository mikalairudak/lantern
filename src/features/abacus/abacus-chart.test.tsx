import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CANDIDATE_ATTRIBUTE } from "./chart-stop";
import { StopRowCell } from "./stop-row-cell";

/**
 * Escape and the versions' names on the chart: a name shown by a pointer resting on a bead, or
 * by a slider's focus from the keys, is put away by Escape with the pointer and the focus left
 * where they are (WCAG 1.4.13), and an Escape that puts nothing away is left to the page.
 */

const CELL_WIDTH = 390;
/** The chart a pointer is on, if any. */
let pointedChart: Element | null = null;
/** A pen, its bead's slide and Motion's frames, well within this. */
const SPRINGS_TIMEOUT = { timeout: 3000 };

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

// jsdom lays nothing out, so it has no scrollIntoView to spy on: stub it, then put back what
// was there, or nothing.
const SCROLL_INTO_VIEW = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Element.prototype.scrollIntoView = () => undefined;
  // jsdom shows a focus as the keys' only once it has heard a key; here every focus is theirs.
  // Nor does it say what a pointer is on: here, the chart a test has put it on.
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (
    this: Element,
    selectors: string,
  ) {
    if (selectors === ":focus-visible") return this === document.activeElement;
    if (selectors === ":hover") return this === pointedChart;
    return matches.call(this, selectors);
  });
});
afterEach(() => {
  pointedChart = null;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (SCROLL_INTO_VIEW)
    Object.defineProperty(Element.prototype, "scrollIntoView", SCROLL_INTO_VIEW);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

/** Alicante's calm beach between its neighbours, the day whole and ready for a hand. */
async function drawTheDay(): Promise<HTMLElement> {
  render(<StopRowCell example={0} state="complete" density={null} />);
  const list = await screen.findByRole("list", { name: "The day" });
  await waitFor(() => expect(list).toHaveAttribute("aria-busy", "false"), SPRINGS_TIMEOUT);
  return list;
}

/** Lets a few frames pass, in which a name the chart would draw is drawn. */
async function nextFrames(): Promise<void> {
  for (let frame = 0; frame < 3; frame += 1) {
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  }
}

/** The versions' names the chart shows. */
function namesShown(): Element[] {
  return [...document.querySelectorAll("[data-tag]")];
}

/** The slider of the stop after the beach, whose arrows reach a version either way. */
function sliderWithVersions(): HTMLElement {
  return screen.getByRole("slider", { name: "Energy at 08:30" });
}

describe("a version's name on the chart and Escape", () => {
  /** The first bead of a version not shown, named once a pointer rests on it. */
  async function pointAtABead(): Promise<Element> {
    const bead = document.querySelector(`[${CANDIDATE_ATTRIBUTE}]`);
    if (!bead) throw new Error("The day drew no version's bead");
    pointedChart = bead.closest("svg");
    fireEvent.pointerEnter(bead);
    await waitFor(() => expect(namesShown()).toHaveLength(1));
    return bead;
  }

  /** Focuses a slider as the keys do, and waits for its versions' names. */
  async function focusASlider(slider: HTMLElement): Promise<void> {
    act(() => slider.focus());
    await waitFor(() => expect(namesShown().length).toBeGreaterThan(0));
  }

  it("puts away a name shown by a pointer on its bead, wherever the focus is", async () => {
    await drawTheDay();
    await pointAtABead();

    const isLeftToThePage = fireEvent.keyDown(document.body, { key: "Escape" });

    expect(isLeftToThePage).toBe(false);
    await waitFor(() => expect(namesShown()).toHaveLength(0));
  });

  it("names the bead again once the pointer has left it and come back", async () => {
    await drawTheDay();
    const bead = await pointAtABead();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(namesShown()).toHaveLength(0));

    fireEvent.pointerLeave(bead);
    fireEvent.pointerEnter(bead);

    await waitFor(() => expect(namesShown()).toHaveLength(1));
  });

  it("keeps a pointer's name for another key, or an Escape something else has answered", async () => {
    await drawTheDay();
    await pointAtABead();
    const answerFirst = (event: KeyboardEvent) => event.preventDefault();
    document.body.addEventListener("keydown", answerFirst);

    fireEvent.keyDown(document.body, { key: "Escape" });
    document.body.removeEventListener("keydown", answerFirst);
    fireEvent.keyDown(document.body, { key: "Enter" });

    // Still named: the next Escape is the one that puts the name away.
    expect(namesShown()).toHaveLength(1);
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(false);
    await waitFor(() => expect(namesShown()).toHaveLength(0));
  });

  it("keeps a still's name, which no pointer holds, whatever its page does", async () => {
    render(<StopRowCell example={0} state="named" density={null} />);
    await waitFor(() => expect(namesShown()).toHaveLength(1), SPRINGS_TIMEOUT);

    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
    expect(namesShown()).toHaveLength(1);
  });

  it("keeps the names a still's held slider shows, a pointer on its chart", async () => {
    render(<StopRowCell example={0} state="keyed" density={null} />);
    await waitFor(() => expect(namesShown().length).toBeGreaterThan(0), SPRINGS_TIMEOUT);
    const shown = namesShown().length;
    pointedChart = screen.getByRole("group", { name: /^The day's energy/ });

    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
    await nextFrames();

    expect(namesShown()).toHaveLength(shown);
  });

  it("leaves an Escape on a still's held slider with no focus behind it to the page", async () => {
    render(<StopRowCell example={0} state="keyed" density={null} />);
    await waitFor(() => expect(namesShown().length).toBeGreaterThan(0), SPRINGS_TIMEOUT);
    const shown = namesShown().length;
    const held = screen.getAllByRole("slider")[0];
    if (!held) throw new Error("The still drew no slider for its stop");

    expect(fireEvent.keyDown(held, { key: "Escape" })).toBe(true);
    await nextFrames();

    expect(namesShown()).toHaveLength(shown);
  });

  it("names a still's held slider again once a focus that put them away has left it", async () => {
    render(<StopRowCell example={0} state="keyed" density={null} />);
    await waitFor(() => expect(namesShown().length).toBeGreaterThan(0), SPRINGS_TIMEOUT);
    // The still's stop opens the day, its slider the first.
    const held = screen.getAllByRole("slider")[0];
    if (!held) throw new Error("The still drew no slider for its stop");
    await focusASlider(held);
    fireEvent.keyDown(held, { key: "Escape" });
    await waitFor(() => expect(namesShown()).toHaveLength(0));

    act(() => held.blur());

    await waitFor(() => expect(namesShown().length).toBeGreaterThan(0));
  });

  it("keeps a pointer's name away while the keys' focus comes and goes, the pointer unmoved", async () => {
    await drawTheDay();
    await pointAtABead();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(namesShown()).toHaveLength(0));
    const slider = sliderWithVersions();
    await focusASlider(slider);

    act(() => slider.blur());

    // The focus's names leave; the pointer's, once drawn, would stay.
    await waitFor(() => expect(namesShown()).toHaveLength(0), SPRINGS_TIMEOUT);
    await nextFrames();
    expect(namesShown()).toHaveLength(0);
  });

  it("names the bead a pointer rests on once Escape has put the focus's names away", async () => {
    await drawTheDay();
    const bead = await pointAtABead();
    const slider = sliderWithVersions();
    await focusASlider(slider);

    fireEvent.keyDown(slider, { key: "Escape" });

    const pointerName = bead.getAttribute("aria-label")?.split(", ")[0] ?? "";
    await waitFor(
      () =>
        expect(namesShown().map((tag) => tag.textContent)).toEqual([
          expect.stringContaining(pointerName),
        ]),
      SPRINGS_TIMEOUT,
    );
    // The next Escape puts the pointer's name away, and the focus's names stay away with it.
    expect(fireEvent.keyDown(slider, { key: "Escape" })).toBe(false);
    await waitFor(() => expect(namesShown()).toHaveLength(0), SPRINGS_TIMEOUT);
    expect(slider).toHaveFocus();
  });

  it("puts away the names a slider's focus shows, the focus left on it", async () => {
    await drawTheDay();
    const slider = sliderWithVersions();
    await focusASlider(slider);

    const isLeftToThePage = fireEvent.keyDown(slider, { key: "Escape" });

    expect(isLeftToThePage).toBe(false);
    await waitFor(() => expect(namesShown()).toHaveLength(0));
    expect(slider).toHaveFocus();
  });

  it("names a slider's versions again once its focus has left and come back", async () => {
    await drawTheDay();
    const slider = sliderWithVersions();
    await focusASlider(slider);
    fireEvent.keyDown(slider, { key: "Escape" });
    await waitFor(() => expect(namesShown()).toHaveLength(0));

    act(() => slider.blur());
    await focusASlider(slider);
  });

  it("names a slider's versions again at its next step, the focus kept on it", async () => {
    await drawTheDay();
    const slider = sliderWithVersions();
    await focusASlider(slider);
    fireEvent.keyDown(slider, { key: "Escape" });
    await waitFor(() => expect(namesShown()).toHaveLength(0));

    fireEvent.keyDown(slider, { key: "ArrowLeft" });

    await waitFor(() => expect(namesShown().length).toBeGreaterThan(0));
    expect(slider).toHaveFocus();
  });

  it("leaves an Escape that puts nothing away to the page", async () => {
    await drawTheDay();
    const slider = sliderWithVersions();
    // A pointer on the chart, on no bead: nothing is named.
    pointedChart = slider.closest("svg");
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);

    await focusASlider(slider);
    fireEvent.keyDown(slider, { key: "Escape" });
    await waitFor(() => expect(namesShown()).toHaveLength(0));

    expect(fireEvent.keyDown(slider, { key: "Escape" })).toBe(true);
  });
});
