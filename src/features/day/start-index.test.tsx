import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { writtenPool } from "./written-pool";
import { INDEX_LABEL, StartIndex } from "./start-index";
import { requestShortGistOf } from "./sentence";
import { DRAWN_STARTS, LONG_START, UNDRAWN_START } from "./start-index-examples";
import { startOffersOf } from "./start-offers";

const STARTS = startOffersOf(writtenPool());

/** Each plate's light, in the index's order. */
function lightsOf(): (string | null)[] {
  return [...document.querySelectorAll("svg[data-picture]")].map((svg) =>
    svg.getAttribute("data-light"),
  );
}

/** The cities whose plates are lit. */
function litCities(): string[] {
  return [...document.querySelectorAll('svg[data-light="lit"]')].map(
    (svg) => svg.closest("button")?.querySelector("span > span")?.textContent ?? "",
  );
}

function cellOf(city: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${city} `) });
}

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

  it("draws the cells a lab holds still: pointed and focused ruled, touched lit alone", () => {
    render(
      <StartIndex
        starts={DRAWN_STARTS}
        onChoose={() => undefined}
        stills={{ Rome: "pointed", Tokyo: "focused", Paris: "touched" }}
      />,
    );
    const cell = (city: string) => screen.getByRole("button", { name: new RegExp(`^${city} `) });
    expect(cell("Rome")).toHaveAttribute("data-pointed");
    expect(cell("Tokyo")).toHaveAttribute("data-pointed");
    expect(cell("Tokyo")).toHaveClass("outline-2");
    expect(cell("Paris")).not.toHaveAttribute("data-pointed");
    expect(lightsOf()).toEqual(
      DRAWN_STARTS.map(({ request }) =>
        ["Rome", "Tokyo", "Paris"].includes(request.city) ? "lit" : "rest",
      ),
    );
  });

  it("lights a plate under a pointer, and puts it out as the pointer leaves", () => {
    render(<StartIndex starts={DRAWN_STARTS} onChoose={() => undefined} />);
    const rome = cellOf("Rome");
    fireEvent.pointerEnter(rome, { pointerType: "mouse" });
    expect(litCities()).toEqual(["Rome"]);
    fireEvent.pointerLeave(rome, { pointerType: "mouse" });
    expect(litCities()).toEqual([]);
  });

  it("lights one plate a touch lands on until a touch lands elsewhere, and never as a hover", () => {
    render(<StartIndex starts={DRAWN_STARTS} onChoose={() => undefined} />);
    fireEvent.pointerEnter(cellOf("Rome"), { pointerType: "touch" });
    expect(litCities()).toEqual([]);
    fireEvent.pointerDown(cellOf("Rome"), { pointerType: "touch" });
    fireEvent.pointerLeave(cellOf("Rome"), { pointerType: "touch" });
    expect(litCities()).toEqual(["Rome"]);
    fireEvent.pointerDown(cellOf("Tokyo"), { pointerType: "touch" });
    expect(litCities()).toEqual(["Tokyo"]);
    // A mouse pressed elsewhere is not a touch, and leaves the touched plate lit.
    fireEvent.pointerDown(document.body, { pointerType: "mouse" });
    expect(litCities()).toEqual(["Tokyo"]);
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(litCities()).toEqual([]);
  });

  it("lights the plate the keyboard's focus reaches, and puts it out as the focus goes", async () => {
    // jsdom has no `:focus-visible`: the keyboard's focus is whatever holds the focus here.
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ":focus-visible"
        ? document.activeElement === this
        : matches.call(this, selector);
    });
    const user = userEvent.setup();
    render(<StartIndex starts={DRAWN_STARTS} onChoose={() => undefined} />);
    await user.tab();
    const first = DRAWN_STARTS[0]!.request.city;
    expect(litCities()).toEqual([first]);
    await user.tab();
    expect(litCities()).toEqual([DRAWN_STARTS[1]!.request.city]);
    vi.restoreAllMocks();
  });

  it("holds every plate's files back while the page's script has not run", () => {
    render(<StartIndex starts={DRAWN_STARTS} onChoose={() => undefined} arePicturesHeld />);
    for (const lines of document.querySelectorAll('rect[data-layer="scene"]')) {
      expect(lines).toHaveAttribute("data-state", "unasked");
    }
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
