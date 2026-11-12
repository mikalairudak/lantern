import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { writtenPool } from "./written-pool";
import { INDEX_LABEL, StartIndex } from "./start-index";
import { requestShortGistOf } from "./sentence";
import { DRAWN_STARTS, LONG_START, UNDRAWN_START } from "./start-index-examples";
import { startOffersOf } from "./start-offers";

const STARTS = startOffersOf(writtenPool());

describe("the start screen's index", () => {
  it("lists each written day by its city and its day in a few words, and opens one on a press", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<StartIndex starts={STARTS} onChoose={onChoose} />);
    const list = screen.getByRole("list", { name: INDEX_LABEL });
    expect(list.querySelectorAll("li")).toHaveLength(STARTS.length);
    const first = STARTS[0]!;
    const cell = screen.getByRole("button", { name: new RegExp(`^${first.request.city}`) });
    expect(cell).toHaveTextContent(requestShortGistOf(first.request).day);
    await user.click(cell);
    expect(onChoose).toHaveBeenCalledWith(first.request);
  });

  it("draws the cell a lab names as pointed at, and no other", () => {
    const pointed = DRAWN_STARTS[1]!.request.city;
    render(<StartIndex starts={DRAWN_STARTS} onChoose={() => undefined} pointedCity={pointed} />);
    const cells = screen.getAllByRole("button");
    const marked = cells.filter((cell) => cell.hasAttribute("data-pointed"));
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveAccessibleName(new RegExp(`^${pointed} `));
  });

  it("names each cell by its city and its day alone, the picture out of what is read", () => {
    render(<StartIndex starts={DRAWN_STARTS} onChoose={() => undefined} />);
    expect(
      screen.getByRole("button", { name: "Paris Calm Sunday slow morning" }),
    ).toBeInTheDocument();
    const madrid = screen.getByRole("button", { name: /^Madrid/ });
    expect(madrid.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(madrid).toHaveAccessibleName("Madrid Lively Sunday out late");
  });

  it("draws every drawn city's picture, and none for a city with no picture, whose caption stays", () => {
    render(
      <StartIndex
        starts={[UNDRAWN_START, ...DRAWN_STARTS, LONG_START]}
        onChoose={() => undefined}
      />,
    );
    const list = screen.getByRole("list", { name: INDEX_LABEL });
    expect(list.querySelectorAll("svg[data-picture]")).toHaveLength(DRAWN_STARTS.length);
    const lisbon = screen.getByRole("button", { name: /^Lisbon/ });
    expect(lisbon.querySelector("svg")).toBeNull();
    expect(lisbon).toHaveTextContent("Balanced Saturday");
    expect(list.querySelectorAll("li")).toHaveLength(DRAWN_STARTS.length + 2);
  });
});
