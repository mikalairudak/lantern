import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { chartScale } from "./geometry";
import { SCALE_BAND_ATTRIBUTE, StickyScale } from "./sticky-scale";
import { STICKY_SCALE_MATRIX } from "./sticky-scale-matrix";

const SCALE = chartScale(358, 640, 7 * 60, 21 * 60);

const bandOf = (container: HTMLElement) => container.querySelector(`[${SCALE_BAND_ATTRIBUTE}]`);

describe("the sticky scale", () => {
  it("says the scale's ends, and names the curve once it can be dragged", () => {
    const view = render(
      <StickyScale scale={SCALE} isCurveNamed={false} clause={null} onBackToPlan={vi.fn()} />,
    );
    expect(screen.getByText(/quieter/)).toBeInTheDocument();
    expect(screen.getByText(/livelier/)).toBeInTheDocument();
    expect(screen.queryByText("drag the curve")).not.toBeInTheDocument();

    view.rerender(<StickyScale scale={SCALE} isCurveNamed clause={null} onBackToPlan={vi.fn()} />);
    expect(screen.getByText("drag the curve")).toBeInTheDocument();
  });

  it("says how a changed day differs from its plan, and takes it back", () => {
    const onBackToPlan = vi.fn();
    const view = render(
      <StickyScale scale={SCALE} isCurveNamed clause={null} onBackToPlan={onBackToPlan} />,
    );
    // The live region is there before the change, so a screen reader hears it come.
    const status = view.container.querySelector("[aria-live='polite']");
    expect(status).toHaveTextContent("");

    view.rerender(
      <StickyScale
        scale={SCALE}
        isCurveNamed
        clause="livelier at lunch"
        onBackToPlan={onBackToPlan}
      />,
    );
    expect(view.container.querySelector("[aria-live='polite']")).toBe(status);
    expect(status).toHaveTextContent("livelier at lunch");
    expect(screen.queryByText("drag the curve")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to the plan" }));
    expect(onBackToPlan).toHaveBeenCalledOnce();
  });

  it("is a whole pointer target in the shared link's look, with no reach past the band", () => {
    render(
      <StickyScale scale={SCALE} isCurveNamed clause="livelier at lunch" onBackToPlan={vi.fn()} />,
    );
    const back = screen.getByRole("button", { name: "Back to the plan" });
    expect(back).toHaveClass("min-h-6", "underline", "pointed:decoration-2");
    expect(back.className).not.toMatch(/after:-inset/);
  });

  it("offers nothing to take back, and is never held, while the day is still being written", () => {
    const { container } = render(
      <StickyScale
        scale={SCALE}
        isCurveNamed={false}
        clause="livelier at lunch"
        onBackToPlan={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Back to the plan" })).not.toBeInTheDocument();
    expect(bandOf(container)).not.toHaveClass("max-sm:sticky");
  });

  it("stands clear where it rests, and is not yet held", () => {
    const { container } = render(
      <StickyScale scale={SCALE} isCurveNamed clause={null} onBackToPlan={vi.fn()} />,
    );
    const band = bandOf(container);
    expect(band).toHaveClass("max-sm:sticky");
    expect(band).not.toHaveClass("bg-ground");
    expect(band).toHaveAttribute(SCALE_BAND_ATTRIBUTE, "");
  });

  it("held, steps aside while a hand is on the curve", () => {
    const view = render(
      <StickyScale
        scale={SCALE}
        isCurveNamed
        clause="livelier at lunch"
        onBackToPlan={vi.fn()}
        isHeldInStill
      />,
    );
    const band = bandOf(view.container);
    expect(band).toHaveAttribute(SCALE_BAND_ATTRIBUTE, "held");
    expect(band).toHaveClass("bg-ground");
    expect(band).not.toHaveClass("opacity-0");

    view.rerender(
      <StickyScale
        scale={SCALE}
        isCurveNamed
        clause="livelier at lunch"
        isDragging
        onBackToPlan={vi.fn()}
        isHeldInStill
      />,
    );
    expect(bandOf(view.container)).toHaveClass("opacity-0");
  });
});

describe("the sticky scale under an open sheet", () => {
  /** A day dragged from its plan, which the band says, with the way back at its end. */
  const CLAUSE = "livelier in the morning";

  it("goes under a sheet that lies over it where it rests, its words and action out of reach, and comes back as it closes", () => {
    const view = render(
      <StickyScale
        scale={SCALE}
        isCurveNamed
        clause={CLAUSE}
        onBackToPlan={vi.fn()}
        isUnderSheet
      />,
    );
    const band = bandOf(view.container);
    expect(band).toHaveClass("opacity-0");
    // Inert, as the browser reads it: out of the Tab order, the pointer's and the reader's.
    expect(band).toHaveAttribute("inert");
    expect(band?.contains(screen.getByRole("button", { name: "Back to the plan" }))).toBe(true);

    view.rerender(
      <StickyScale scale={SCALE} isCurveNamed clause={CLAUSE} onBackToPlan={vi.fn()} />,
    );
    expect(bandOf(view.container)).not.toHaveClass("opacity-0");
    expect(screen.getByRole("button", { name: "Back to the plan" })).toBeInTheDocument();
  });

  it("held at a phone's top, stays over the sheet on its own ground, its action in reach", () => {
    const view = render(
      <StickyScale
        scale={SCALE}
        isCurveNamed
        clause={CLAUSE}
        onBackToPlan={vi.fn()}
        isUnderSheet
        isHeldInStill
      />,
    );
    const band = bandOf(view.container);
    expect(band).toHaveClass("bg-ground");
    expect(band).not.toHaveClass("opacity-0");
    expect(band).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Back to the plan" })).toBeInTheDocument();
  });

  it("says the scale's words while a changed word's proposal is written, as at rest", () => {
    render(<StickyScale scale={SCALE} isCurveNamed clause={null} onBackToPlan={vi.fn()} />);

    // A changed word's work is said on its fork row: the band names the curve throughout.
    expect(screen.getByText("drag the curve")).toBeInTheDocument();
  });
});

describe("STICKY_SCALE_MATRIX", () => {
  it("sets the band at rest and held, through each moment of the day", () => {
    expect(STICKY_SCALE_MATRIX.axes.map(({ name, labels }) => [name, labels.length])).toEqual([
      ["state", 9],
    ]);
  });
});
