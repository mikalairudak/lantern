import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { THEME_CHOICE_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme";
import { ThemeChoice } from "./theme-choice";
import { ThemeWordCell } from "./theme-word-cell";

const root = document.documentElement;

beforeAll(() => {
  // The list unfolds to its measured height; jsdom measures nothing and has no observer.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
});
afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  root.removeAttribute("data-theme");
  root.removeAttribute(THEME_CHOICE_ATTRIBUTE);
  localStorage.clear();
});

function themeButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Theme: / });
}

/** The icons in the button, by the choice each draws. */
function iconsIn(element: Element): string[] {
  return [...element.querySelectorAll("[data-theme-icon]")].map(
    (icon) => icon.getAttribute("data-theme-icon") ?? "",
  );
}

describe("the theme's icon", () => {
  it("carries every choice's icon from the server, for <html> to pick one before the first paint", () => {
    // The server cannot know the visitor's choice, so its page holds all three icons and the
    // hint's three names, each shown by the note the head script sets on <html>.
    const page = document.createElement("div");
    page.innerHTML = renderToString(<ThemeChoice />);
    const button = within(page).getByRole("button");
    expect(iconsIn(button)).toEqual(["system", "light", "dark"]);
    expect(button.querySelector('[data-theme-icon="light"]')).toHaveClass(
      "hidden",
      "chose-light:inline",
    );
    expect(button).toHaveAttribute("aria-label", "Theme: System");
    expect(page).toHaveTextContent("Theme · SystemLightDark");
  });

  it("is named for the choice once the page is live, the system's on a dark device too", () => {
    root.setAttribute("data-theme", "dark");
    const { unmount } = render(<ThemeChoice />);
    expect(themeButton()).toHaveAccessibleName("Theme: Dark");
    expect(themeButton()).toHaveAttribute("aria-expanded", "false");
    unmount();

    root.removeAttribute("data-theme");
    render(<ThemeChoice />);
    expect(themeButton()).toHaveAccessibleName("Theme: System");
  });

  it("opens its list on the theme the page is set in, each answer with its icon", async () => {
    root.setAttribute("data-theme", "dark");
    render(<ThemeChoice />);
    await userEvent.click(themeButton());
    expect(themeButton()).toHaveAttribute("aria-expanded", "true");
    const current = screen.getByRole("option", { selected: true });
    expect(current).toHaveTextContent("Dark");
    expect(current.querySelector("svg.lucide-check")).not.toBeNull();
    expect(screen.getByRole("option", { name: /System/ })).toHaveTextContent(
      "as this device is set",
    );
    expect(
      screen.getAllByRole("option").map((option) => option.querySelector("svg")?.classList[1]),
    ).toEqual(["lucide-monitor", "lucide-sun", "lucide-moon"]);
  });

  it("sets and keeps a theme chosen from the keyboard, and gives the focus back", async () => {
    render(<ThemeChoice />);
    themeButton().focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("listbox", { name: "Theme" })).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    await waitFor(() => expect(themeButton()).toHaveFocus());
    expect(themeButton()).toHaveAccessibleName("Theme: Light");
  });

  it("goes back to the system's theme when that is chosen", async () => {
    root.setAttribute("data-theme", "light");
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<ThemeChoice />);
    await userEvent.click(themeButton());
    await userEvent.click(screen.getByRole("option", { name: /System/ }));
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("closes on Escape with the focus on the icon, and leaves the theme as it was", async () => {
    render(<ThemeChoice />);
    await userEvent.click(themeButton());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(themeButton()).toHaveAttribute("aria-expanded", "false"));
    expect(themeButton()).toHaveFocus();
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("closes its list and gives the focus back before the page crosses to the theme chosen", async () => {
    let update: (() => void) | undefined;
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: vi.fn((callback: () => void) => {
        update = callback;
      }),
    });
    render(<ThemeChoice />);
    await userEvent.click(themeButton());
    await userEvent.click(screen.getByRole("option", { name: /Dark/ }));

    // The browser takes its old picture once the list is gone, and only then sets the theme.
    await waitFor(() => expect(screen.queryByRole("listbox", { name: "Theme" })).toBeNull());
    expect(themeButton()).toHaveFocus();
    expect(root.hasAttribute("data-theme")).toBe(false);
    act(() => update?.());
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(themeButton()).toHaveAccessibleName("Theme: Dark");
    expect(themeButton()).toHaveFocus();
  });

  it("pressed again, closes its list and keeps it closed", async () => {
    render(<ThemeChoice />);
    await userEvent.click(themeButton());
    await userEvent.click(themeButton());
    await waitFor(() => expect(screen.queryByRole("listbox", { name: "Theme" })).toBeNull());
    expect(themeButton()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("the theme icon's lab cell", () => {
  it("draws its list open a frame after the cell, without taking the focus", async () => {
    render(<ThemeWordCell choice="light" isOpen isHintShown={false} />);
    expect(themeButton()).toHaveAttribute("aria-expanded", "false");
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(themeButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Light");
    expect(document.body).toHaveFocus();
  });

  it("draws its own choice's icon and hint, whatever the page's <html> notes", () => {
    root.setAttribute(THEME_CHOICE_ATTRIBUTE, "system");
    const { container } = render(<ThemeWordCell choice="dark" isOpen={false} isHintShown />);
    expect(iconsIn(themeButton())).toEqual(["dark"]);
    expect(themeButton()).toHaveAccessibleName("Theme: Dark");
    expect(container).toHaveTextContent("Theme · Dark");
  });
});
