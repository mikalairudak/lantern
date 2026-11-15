import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { YOUR_DAYS_HEADING } from "./your-days-list";
import { YOUR_DAYS_LEDGER_MATRIX } from "./your-days-ledger-matrix";

const DAYS_AXIS = 0;
const STATE_AXIS = 1;

const labelsOf = (axis: number) => YOUR_DAYS_LEDGER_MATRIX.axes[axis]!.labels;

describe("YOUR_DAYS_LEDGER_MATRIX", () => {
  it("lists the visitor's days in every set, the newest three until all are shown", () => {
    const counts = labelsOf(DAYS_AXIS).map((_, at) => {
      render(<>{YOUR_DAYS_LEDGER_MATRIX.renderCell([at, 0], "phone")}</>);
      const count = within(screen.getByRole("list", { name: YOUR_DAYS_HEADING })).getAllByRole(
        "link",
      ).length;
      cleanup();
      return count;
    });

    expect(counts).toEqual([1, 1, 2, 3, 3, 12, 1, 3, 3, 3, 3]);
  });

  it("holds the cells the list lacked: a later date, a link past its days, one word apart", () => {
    const labels = labelsOf(DAYS_AXIS);
    render(
      <>
        {YOUR_DAYS_LEDGER_MATRIX.renderCell(
          [labels.findIndex((label) => label.startsWith("a later date")), 0],
          "phone",
        )}
      </>,
    );

    const rows = screen.getAllByRole("link");
    expect(rows[0]).toHaveAccessibleName(/\. 21 Nov$/);
    expect(rows[2]).toHaveAccessibleName(/· link expired\. 12 Oct$/);
  });

  it("plays the newest day from being written to written at a press, its row in place", async () => {
    const user = userEvent.setup();
    const played = labelsOf(STATE_AXIS).findIndex((label) => label.includes("played"));
    render(<>{YOUR_DAYS_LEDGER_MATRIX.renderCell([3, played], "wide")}</>);

    const newest = () => screen.getAllByRole("link")[0];
    expect(newest()).toHaveAccessibleName(/\. writing$/);
    await user.click(screen.getByRole("button", { name: "Finish writing the newest" }));
    expect(newest()).toHaveAccessibleName(/\. today$/);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Write the newest again" }));
    expect(newest()).toHaveAccessibleName(/\. writing$/);
  });

  it("ends every played set in a way the product ends a day it writes", async () => {
    const user = userEvent.setup();
    const played = labelsOf(STATE_AXIS).findIndex((label) => label.includes("played"));

    for (const [at, label] of labelsOf(DAYS_AXIS).entries()) {
      render(<>{YOUR_DAYS_LEDGER_MATRIX.renderCell([at, played], "phone")}</>);
      const newest = () => screen.getAllByRole("link")[0]!.textContent;
      expect(newest(), label).toMatch(/writing$/);
      await user.click(screen.getByRole("button", { name: "Finish writing the newest" }));
      expect(newest(), label).not.toMatch(/writing$/);
      expect(newest(), label).not.toMatch(/link expired/);
      cleanup();
    }
  });

  it("shoots the sets at rest for the baseline, never the played cell", () => {
    expect(YOUR_DAYS_LEDGER_MATRIX.baseline).toEqual([{ rows: DAYS_AXIS, columns: DAYS_AXIS }]);
  });
});
