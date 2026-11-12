import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DayEnd, type DayEndProps } from "./day-end-line";
import { DAY_END_EXAMPLES, KANAZAWA_CHECKS, writtenPicksOf } from "./day-end-examples";

const TIED = "\u00A0";

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
    expect(screen.getByText(/^Home by quarter past eight/).textContent).toMatch(
      new RegExp(`^Home by quarter past eight ·${TIED}8${TIED}stops ·${TIED}about${TIED}`),
    );
    expect(screen.getByText(/places found on OpenStreetMap$/)).toHaveTextContent(
      "3 of 8 places found on OpenStreetMap",
    );
    // The ways to take the day along are the day menu's; a page without script, which has no
    // menu, keeps the walking route here.
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("noscript")).not.toBeNull();
  });

  it("says no distance and keeps no route for a day of one stop", () => {
    const { container } = render(<DayEnd {...exampleOf(/^one stop/)} />);

    expect(screen.getByText(/^Home by/).textContent).toBe(`Home by noon ·${TIED}1${TIED}stop`);
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
