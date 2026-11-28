import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GOLDEN_HOUR } from "./golden-hour-words";
import { StartTime, timeToneOf } from "./stop-row";

const TIME_WIDTH = 48;

/** A stop's time on the chart, alone in its row as a bare row places it. */
function drawTime(time: string, isGoldenStart: boolean, isLit = false): HTMLElement {
  render(
    <ul>
      <li>
        <StartTime
          time={time}
          width={TIME_WIDTH}
          tone={timeToneOf(isLit, isGoldenStart)}
          isGoldenStart={isGoldenStart}
        />
      </li>
    </ul>,
  );
  return screen.getByRole("listitem");
}

describe("a stop's time on the chart", () => {
  it("says golden hour after the time of a stop that starts in it, for a screen reader alone", () => {
    // Alicante's Explanada at 17:20, as the sun goes down over the bay.
    const row = drawTime("17:20", true);

    // In the time's own box, read as one line with it; its attribute keeps the time alone.
    const time = row.querySelector("[data-start-time]");
    expect(time).toHaveTextContent(`17:20, ${GOLDEN_HOUR}`);
    expect(time).toHaveAttribute("data-start-time", "17:20");
    expect(time).toContainElement(screen.getByText(`, ${GOLDEN_HOUR}`));
    expect(screen.getByText(`, ${GOLDEN_HOUR}`)).toHaveClass("sr-only");
  });

  it("says it while the stop is lit and its time is in ink, not amber", () => {
    const row = drawTime("17:20", true, true);

    expect(row.querySelector("[data-start-time]")).toHaveClass("text-ink");
    expect(row).toHaveTextContent(`17:20, ${GOLDEN_HOUR}`);
  });

  it("says the time alone for a stop in plain daylight", () => {
    const row = drawTime("16:15", false);

    expect(row).toHaveTextContent(/^16:15$/);
    expect(screen.queryByText(`, ${GOLDEN_HOUR}`)).toBeNull();
  });
});
