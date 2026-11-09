import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_CHOICE_ATTRIBUTE, THEME_SCRIPT, THEME_STORAGE_KEY } from "./theme";
import { ThemeScript } from "./theme-script";

const root = document.documentElement;

afterEach(() => {
  root.removeAttribute("data-theme");
  root.removeAttribute(THEME_CHOICE_ATTRIBUTE);
  localStorage.clear();
});

describe("ThemeScript", () => {
  it("sets a kept theme once React draws the page, where the head script never ran", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    const { container } = render(<ThemeScript />);

    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("dark");
    // Drawn by React in the browser, the script is plain text, which nothing runs.
    const script = container.querySelector("script");
    expect(script).toHaveAttribute("type", "text/plain");
    expect(script?.innerHTML).toBe(THEME_SCRIPT);
  });
});
