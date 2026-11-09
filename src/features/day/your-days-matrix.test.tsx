import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { YOUR_DAYS_HEADING } from "./your-days-list";
import { YOUR_DAYS_MATRIX } from "./your-days-matrix";

describe("YOUR_DAYS_MATRIX", () => {
  it("lists the visitor's days in every cell, at most three until all are asked for", () => {
    const [cells] = YOUR_DAYS_MATRIX.axes.map((axis) => axis.labels.length);
    const counts: number[] = [];

    for (let cell = 0; cell < cells!; cell += 1) {
      render(<>{YOUR_DAYS_MATRIX.renderCell([cell], "phone")}</>);
      expect(screen.getByRole("list", { name: YOUR_DAYS_HEADING })).toBeInTheDocument();
      counts.push(screen.getAllByRole("listitem").length);
      cleanup();
    }
    expect(counts).toEqual([1, 1, 1, 3, 3, 12, 1]);
  });
});
