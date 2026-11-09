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
});
