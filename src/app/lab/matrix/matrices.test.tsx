import { render, screen, waitFor } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FAILED_NOTE, READING_NOTE } from "@/features/itinerary/use-still";
import type { LabMatrix } from "@/lib/lab-matrix";
import { MATRICES } from "./matrices";

// What a phone cell gives its component, a 390 px phone inside the page's two 16 px gutters:
// jsdom lays nothing out, and a chart needs a width to draw its rows.
const CELL_WIDTH = 358;

class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: CELL_WIDTH, height: 0 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

// jsdom lays nothing out, so it may have no scrollIntoView to spy on: stub it, then put
// back what was there, or nothing.
const SCROLL_INTO_VIEW = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (SCROLL_INTO_VIEW)
    Object.defineProperty(Element.prototype, "scrollIntoView", SCROLL_INTO_VIEW);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

/** Every choice of one value per axis. */
function choicesOf(matrix: LabMatrix): number[][] {
  return matrix.axes.reduce<number[][]>(
    (all, { labels }) => all.flatMap((choice) => labels.map((_, at) => [...choice, at])),
    [[]],
  );
}

/** Every cell of every matrix the lab lists, named as the grid labels it. */
const CELLS = MATRICES.flatMap((matrix) =>
  choicesOf(matrix).map((choice) => ({
    matrix,
    choice,
    name: `${matrix.key}: ${choice.map((at, axis) => matrix.axes[axis]?.labels[at]).join(" · ")}`,
  })),
);

describe("every registered matrix", () => {
  it("lists at least one cell for each matrix", () => {
    for (const matrix of MATRICES) expect(choicesOf(matrix).length).toBeGreaterThan(0);
  });

  it.each(CELLS)("draws $name", async ({ matrix, choice }) => {
    const errors = vi.spyOn(console, "error");
    // As the renderer sets each cell.
    const { container } = render(
      <MotionConfig reducedMotion="user">{matrix.renderCell(choice, "phone")}</MotionConfig>,
    );

    await waitFor(() => expect(screen.queryByText(READING_NOTE)).not.toBeInTheDocument());
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByText((text) => text.startsWith(FAILED_NOTE))).not.toBeInTheDocument();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
