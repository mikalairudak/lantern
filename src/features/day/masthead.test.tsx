import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Masthead } from "./masthead";

describe("the masthead", () => {
  it("leads home from its wordmark away from the start screen", () => {
    render(<Masthead action={<button type="button">Plan another day</button>} />);
    expect(screen.getByRole("link", { name: "Lantern" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Plan another day" })).toBeInTheDocument();
    // The theme is an icon, named for the setting and the choice.
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeInTheDocument();
  });

  it("sets the wordmark as the name alone on the start screen itself, with the theme alone after it", () => {
    render(<Masthead isHome />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Lantern")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Theme: System"]);
  });

  it.each([
    [
      "after the page's action",
      <Masthead key="day" action={<button type="button">Plan another day</button>} />,
    ],
    ["with no action", <Masthead key="home" isHome />],
  ])("sets the theme's icon at the small type's lowercase middle %s", (_, masthead) => {
    render(masthead);
    // The icon's own box, and around it the line of small type it is set in.
    const iconBox = screen.getByRole("button", { name: "Theme: System" }).parentElement;
    expect(iconBox?.parentElement).toHaveClass("type-note", "*:align-middle");
  });
});
