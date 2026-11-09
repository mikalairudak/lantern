import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DAY_SHAPE_MATRIX } from "./day-shape-matrix";

describe("DAY_SHAPE_MATRIX", () => {
  it("sets every start it lists as the start screen does, a bead for each stop", () => {
    const [days] = DAY_SHAPE_MATRIX.axes.map((axis) => axis.labels.length);
    const beads: number[] = [];

    for (let day = 0; day < days!; day += 1) {
      const { container } = render(<>{DAY_SHAPE_MATRIX.renderCell([day], "phone")}</>);
      expect(screen.getByRole("button")).toBeInTheDocument();
      beads.push(container.querySelectorAll("svg circle").length);
      cleanup();
    }
    // One stop, twelve, and the rest between.
    expect(Math.min(...beads)).toBe(1);
    expect(Math.max(...beads)).toBe(12);
  });
});
