import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DayMenu, TAKE_THIS_DAY } from "./day-menu";
import { Masthead } from "./masthead";
import { NEW_DAY, NewDayButton } from "./new-day";

/**
 * The theme's button by its name. jsdom applies no stylesheet, so both looks' names stand in
 * it, where a browser shows the one for the page's look.
 */
const THEME_NAME = /^Switch to /;

const MENU = <DayMenu items={[{ key: "link", label: "Copy the link", note: "Opens this day" }]} />;

describe("the masthead", () => {
  it("leads home from its wordmark away from the start screen, this day's menu, a new day and the theme on its right", () => {
    const { container } = render(
      <Masthead menu={MENU} newDay={<NewDayButton onPress={() => undefined} />} />,
    );
    const home = screen.getByRole("link", { name: "Lantern" });
    expect(home).toHaveAttribute("href", "/");
    // The mark is set in ems of the word, so its bead stands on the word's lowercase middle.
    expect(home.querySelector("svg")).toHaveStyle({ height: "1.75em" });
    // The three kinds in their order, parted by space alone: no rule between them.
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      TAKE_THIS_DAY,
      NEW_DAY,
      expect.stringMatching(THEME_NAME),
    ]);
    expect(container.querySelector(".w-px")).toBeNull();
    // The row is a container, so the new day stands in it from a row of `@masthead`.
    expect(container.firstElementChild).toHaveClass("@container");
    expect(screen.getByRole("button", { name: NEW_DAY })).toHaveClass(
      "hidden",
      "@masthead:inline-flex",
    );
  });

  it("sets the wordmark as the name alone on the start screen itself, with the theme alone after it", () => {
    const { container } = render(<Masthead isHome />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Lantern")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(THEME_NAME);
    expect(container.querySelector(".w-px")).toBeNull();
  });

  it.each([
    ["after the day's menu", <Masthead key="day" menu={MENU} />],
    ["with no menu", <Masthead key="home" isHome />],
  ])("sets the theme's icon at the small type's lowercase middle %s", (_, masthead) => {
    render(masthead);
    // The icon's own box, and around it the line of small type it is set in.
    const iconBox = screen.getByRole("button", { name: THEME_NAME }).parentElement;
    expect(iconBox?.parentElement).toHaveClass("type-note", "*:align-middle");
  });

  it("leaves Escape to an open menu: it closes and gives the focus back, and the theme's helper goes too", async () => {
    render(<Masthead menu={MENU} />);
    await userEvent.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    // A pointer rests on the theme's button, whose helper Escape puts away as well.
    const themeBox = screen.getByRole("button", { name: THEME_NAME }).parentElement!;
    const matches = vi.spyOn(themeBox, "matches").mockImplementation((query) => query === ":hover");
    expect(themeBox.querySelector("[data-theme-helper]")).not.toHaveClass("hidden");
    await userEvent.keyboard("{Escape}");
    matches.mockRestore();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: TAKE_THIS_DAY })).toHaveFocus();
    expect(themeBox.querySelector("[data-theme-helper]")).toHaveClass("hidden");
  });
});
