import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DayEnd, type DayEndProps } from "./day-end-line";
import { DAY_END_EXAMPLES, KANAZAWA_CHECKS, writtenPicksOf } from "./day-end-examples";

/** The space a line never breaks at: in a run, between a dot and its word, a count and its unit. */
const TIED = "\u00A0";

/**
 * The summary as it reads, and each run it keeps whole on a line: a box that does not wrap but
 * in a narrow line (`TIED_CLASSES`), where only its plain spaces may break.
 */
function summaryOf(): { text: string; runs: string[] } {
  const summary = screen.getByText(/^Home by/, { selector: "p" });
  const runs = [...summary.querySelectorAll("span")]
    .filter((run) => run.classList.contains("@max-narrow:whitespace-normal"))
    .map((run) => run.textContent);
  return { text: summary.textContent, runs };
}

function exampleOf(label: RegExp): DayEndProps {
  const found = DAY_END_EXAMPLES.find((example) => label.test(example.label));
  if (!found) throw new Error(`No example ${label}`);
  const { day, shown, checks, isCut } = found;
  return { day, shown, checks, isCut };
}

const KANAZAWA = exampleOf(/^a written day/);

describe("DayEnd", () => {
  it("says when the day ends, its stops and how far, and what the map found, with no way of its own", () => {
    const { container } = render(<DayEnd {...KANAZAWA} />);

    expect(screen.getByText("20:15")).toBeInTheDocument();
    // Each count whole on a line, and a dot never starting one.
    const { text, runs } = summaryOf();
    expect(text).toMatch(
      new RegExp(`^Home by quarter past eight ·${TIED}8${TIED}stops ·${TIED}about `),
    );
    expect(runs[0]).toBe(`·${TIED}8${TIED}stops`);
    expect(runs[1]).toMatch(new RegExp(`^·${TIED}about \\d`));
    expect(screen.getByText(/places found on OpenStreetMap$/)).toHaveTextContent(
      "3 of 8 places found on OpenStreetMap",
    );
    // The ways to take the day along are the day menu's; a page without script, which has no
    // menu, keeps the walking route here.
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("noscript")).not.toBeNull();
  });

  // At 320 px with the browser's text at 200% the distance's run is wider than the line: it
  // breaks there only where neither a dot would end a line nor a count leave its unit.
  it("keeps each dot with the word after it and each count with its unit where a narrow line breaks a run", () => {
    render(<DayEnd {...KANAZAWA} />);

    expect(summaryOf().runs).toEqual([
      `·${TIED}8${TIED}stops`,
      `·${TIED}about 7.1${TIED}km on foot`,
    ]);
  });

  it("keeps the space after the dot that leads each run unbroken, a narrow line never ending on it", () => {
    render(<DayEnd {...KANAZAWA} />);

    for (const run of summaryOf().runs) expect(run.startsWith(`·${TIED}`)).toBe(true);
  });

  it("says no distance and keeps no route for a day of one stop", () => {
    const { container } = render(<DayEnd {...exampleOf(/^one stop/)} />);

    expect(summaryOf()).toEqual({
      text: `Home by noon ·${TIED}1${TIED}stop`,
      runs: [`·${TIED}1${TIED}stop`],
    });
    expect(container.querySelector("noscript")).toBeNull();
  });

  it("says a day past midnight ends in the morning", () => {
    render(<DayEnd {...exampleOf(/^past midnight/)} />);

    expect(screen.getByText("04:00")).toBeInTheDocument();
    expect(screen.getByText(/^Home by/)).toHaveTextContent(/^Home by four in the morning/);
  });

  it("says nothing found where no check ran, or while one still runs", () => {
    const { rerender } = render(<DayEnd {...exampleOf(/^written by hand/)} />);
    expect(screen.queryByText(/found on OpenStreetMap/)).toBeNull();

    rerender(<DayEnd {...exampleOf(/^a place still being looked up/)} />);
    expect(screen.queryByText(/found on OpenStreetMap/)).toBeNull();

    rerender(<DayEnd {...exampleOf(/^every place looked up, none found/)} />);
    expect(screen.getByText(/found on OpenStreetMap/)).toHaveTextContent(/^0 of 8 places/);
  });
});

describe("the day's end examples", () => {
  it("check Kanazawa's places as its run did, and pick what the model picked", () => {
    expect(Object.keys(KANAZAWA_CHECKS).length).toBeGreaterThan(0);
    expect(KANAZAWA.shown).toEqual(writtenPicksOf(KANAZAWA.day));
  });
});
