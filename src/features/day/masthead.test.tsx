import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DayMenu, TAKE_THIS_DAY } from "./day-menu";
import { Masthead } from "./masthead";

/**
 * The theme's button by its name. jsdom applies no stylesheet, so both looks' names stand in
 * it, where a browser shows the one for the page's look.
 */
const THEME_NAME = /^Switch to /;

const MENU = <DayMenu items={[{ key: "another", label: "Plan another day", note: "Elsewhere" }]} />;

describe("the masthead", () => {
  it("leads home from its wordmark away from the start screen, the day's menu and the theme on its right", () => {
    const { container } = render(<Masthead menu={MENU} />);
    const home = screen.getByRole("link", { name: "Lantern" });
    expect(home).toHaveAttribute("href", "/");
    // The mark is set in ems of the word, so its bead stands on the word's lowercase middle.
    expect(home.querySelector("svg")).toHaveStyle({ height: "1.75em" });
    expect(screen.getByRole("button", { name: TAKE_THIS_DAY })).toBeInTheDocument();
    // The theme is an icon, named for the look a press gives, a short rule before it.
    expect(screen.getByRole("button", { name: THEME_NAME })).toBeInTheDocument();
    expect(container.querySelector(".w-px")).not.toBeNull();
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
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: TAKE_THIS_DAY })).toHaveFocus();
  });
});
