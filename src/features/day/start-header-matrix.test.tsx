import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import { START_HEADER_MATRIX } from "./start-header-matrix";
import { PROMISE } from "./start-header";
import { INDEX_LABEL } from "./start-index";

describe("START_HEADER_MATRIX", () => {
  it("draws every line and note it lists, over the quick starts", () => {
    const sizes = START_HEADER_MATRIX.axes.map((axis) => axis.labels.length);
    const choices = sizes.reduce<number[][]>(
      (all, size) => all.flatMap((choice) => [...Array(size).keys()].map((at) => [...choice, at])),
      [[]],
    );

    for (const choice of choices) {
      render(<>{START_HEADER_MATRIX.renderCell(choice, "phone")}</>);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(PROMISE);
      expect(
        within(screen.getByRole("list", { name: INDEX_LABEL })).getAllByRole("button"),
      ).toHaveLength(WRITTEN_REQUESTS.length);
      expect(document.activeElement).toBe(document.body);
      cleanup();
    }
    expect(choices).toHaveLength(14 * 2);
    // A cell asking for the city does not take the focus, or the matrix would scroll to it.
    expect(document.activeElement).toBe(document.body);
  });
});
