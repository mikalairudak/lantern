import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_CHOICE_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme";
import { LOOK_STATUS, ThemeButton, ThemeChoice } from "./theme-choice";
import { ThemeButtonCell } from "./theme-button-cell";

const root = document.documentElement;

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  vi.unstubAllGlobals();
  root.removeAttribute("data-theme");
  root.removeAttribute(THEME_CHOICE_ATTRIBUTE);
  localStorage.clear();
});

/** A device whose scheme is `scheme`, with no view transitions, so a press sets its look at once. */
function stubDevice(scheme: "light" | "dark"): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === `(prefers-color-scheme: ${scheme})`,
  }));
}

/** The theme's button, whose name in jsdom holds both looks' names: no stylesheet applies. */
function themeButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Switch to / });
}

/** The icons in an element, by what each draws. */
function iconsIn(element: Element): string[] {
  return [...element.querySelectorAll("[data-theme-icon]")].map(
    (icon) => icon.getAttribute("data-theme-icon") ?? "",
  );
}

function helper(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-theme-helper]");
  if (!found) throw new Error("No helper drawn");
  return found;
}

describe("the theme's button", () => {
  it("carries both looks from the server, for <html> and the device to pick one before the first paint", () => {
    // The server cannot know the look, so its page holds a moon and a sun, both names and both
    // helper words, each shown by the look the page stands in.
    const page = document.createElement("div");
    page.innerHTML = renderToString(<ThemeChoice />);
    const button = within(page).getByRole("button");
    expect(iconsIn(button)).toEqual(["moon", "sun"]);
    expect(button.querySelector('[data-theme-icon="moon"]')).toHaveClass(
      "hidden",
      "page-day:inline",
    );
    expect(button.querySelector('[data-theme-icon="sun"]')).toHaveClass(
      "hidden",
      "page-night:inline",
    );
    // Named by its content, which CSS chooses as it chooses the icon; no list, so no popup.
    expect(button).not.toHaveAttribute("aria-label");
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(button).not.toHaveAttribute("aria-pressed");
    expect(button).toHaveTextContent("Switch to dark themeSwitch to light theme");
    expect(page.querySelector("[data-theme-helper]")).toHaveTextContent("DarkLight");
    expect(page.querySelector("[data-theme-helper]")).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    // [device, stored before the press, the look a press gives, stored after it]
    ["light", null, "dark", "dark"],
    ["dark", null, "light", "light"],
    ["light", "dark", "light", null],
    ["dark", "light", "dark", null],
    // A choice kept from before that the device has come to agree with: the press still
    // changes the page, and keeps the look it gives.
    ["light", "light", "dark", "dark"],
    ["dark", "dark", "light", "light"],
  ] as const)(
    "on a %s device with %s kept, a press gives %s and keeps %s",
    async (device, stored, look, kept) => {
      stubDevice(device);
      if (stored) {
        localStorage.setItem(THEME_STORAGE_KEY, stored);
        root.setAttribute("data-theme", stored);
      }
      render(<ThemeChoice />);
      await userEvent.click(themeButton());
      expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe(kept ?? "system");
      expect(root.getAttribute("data-theme")).toBe(kept);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(kept);
      expect(screen.getByRole("status")).toHaveTextContent(LOOK_STATUS[look]);
    },
  );

  it("turns the page back on the next press, and follows the device again", async () => {
    stubDevice("light");
    render(<ThemeChoice />);
    await userEvent.click(themeButton());
    expect(screen.getByRole("status")).toHaveTextContent("The page is dark");
    await userEvent.click(themeButton());
    expect(screen.getByRole("status")).toHaveTextContent("The page is light");
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("presses from the keyboard and keeps the focus on itself", async () => {
    stubDevice("light");
    render(<ThemeChoice />);
    themeButton().focus();
    await userEvent.keyboard("{Enter}");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(themeButton()).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("takes no press from the keys while the page crosses, and the next once it has", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-color-scheme: light)" || query.includes("no-preference"),
    }));
    const transitions: { update: () => void; finish: () => void }[] = [];
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: vi.fn((update: () => void) => {
        let finish: () => void = () => undefined;
        const finished = new Promise<void>((resolve) => (finish = resolve));
        transitions.push({ update, finish });
        return { finished };
      }),
    });
    render(<ThemeChoice />);
    themeButton().focus();
    await userEvent.keyboard("{Enter}");
    act(() => transitions[0]!.update());
    expect(root.getAttribute("data-theme")).toBe("dark");
    // The fade still runs: a second press starts no crossing and keeps nothing.
    await userEvent.keyboard("{Enter}");
    expect(transitions).toHaveLength(1);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("status")).toHaveTextContent("The page is dark");

    await act(async () => transitions[0]!.finish());
    await userEvent.keyboard("{Enter}");
    expect(transitions).toHaveLength(2);
    act(() => transitions[1]!.update());
    await act(async () => transitions[1]!.finish());
  });

  it("presses once for a held Enter: a repeated key presses nothing", () => {
    stubDevice("light");
    render(<ThemeChoice />);
    const isFollowed = (repeat: boolean) =>
      fireEvent.keyDown(themeButton(), { key: "Enter", repeat });
    // `fireEvent` answers false when the default, the press, was prevented.
    expect(isFollowed(false)).toBe(true);
    expect(isFollowed(true)).toBe(false);
  });

  it("holds its status only while the page stands in the look its own press gave", async () => {
    stubDevice("light");
    render(<ThemeChoice />);
    expect(screen.getByRole("status")).toHaveTextContent("");
    await userEvent.click(themeButton());
    expect(screen.getByRole("status")).toHaveTextContent("The page is dark");
    // Another tab turns the page back: the status says nothing false.
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: null }));
    });
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("puts its helper away on Escape under a pointer, the focus elsewhere", async () => {
    stubDevice("light");
    render(<ThemeChoice />);
    const box = themeButton().parentElement!;
    const matches = vi.spyOn(box, "matches").mockImplementation((query) => query === ":hover");
    await userEvent.keyboard("{Escape}");
    expect(helper()).toHaveClass("hidden");
    matches.mockRestore();
    // Back once the pointer has left the box.
    fireEvent.pointerMove(document, { clientX: 400, clientY: 400 });
    expect(helper()).not.toHaveClass("hidden");
  });

  it("hides its helper on a pointer's press until the pointer has left its box", async () => {
    stubDevice("light");
    render(<ThemeChoice />);
    expect(helper()).not.toHaveClass("hidden");
    await userEvent.click(themeButton());
    expect(helper()).toHaveClass("hidden");
    // The crossing lays its pictures over the page, and the browser says the pointer left: it
    // has not moved, so the helper stays away.
    fireEvent.pointerLeave(themeButton().parentElement!);
    expect(helper()).toHaveClass("hidden");
    // jsdom draws every box at nought, so any point past it is outside.
    fireEvent.pointerMove(document, { clientX: 400, clientY: 400 });
    expect(helper()).not.toHaveClass("hidden");
  });

  it("hides its helper on a press from the keys or Escape until the focus leaves", async () => {
    stubDevice("light");
    render(<ThemeChoice />);
    themeButton().focus();
    await userEvent.keyboard("{Enter}");
    expect(helper()).toHaveClass("hidden");
    fireEvent.pointerMove(document, { clientX: 400, clientY: 400 });
    expect(helper()).toHaveClass("hidden");
    act(() => themeButton().blur());
    expect(helper()).not.toHaveClass("hidden");

    themeButton().focus();
    await userEvent.keyboard("{Escape}");
    expect(helper()).toHaveClass("hidden");
    // Escape changes nothing else.
    expect(root.getAttribute("data-theme")).toBe("dark");
    act(() => themeButton().blur());
    expect(helper()).not.toHaveClass("hidden");
  });

  it("shows its helper under a pointer after the wait, and by the keyboard's focus at once", () => {
    render(<ThemeButton onPress={() => "dark"} />);
    expect(helper()).toHaveClass(
      "opacity-0",
      "peer-hover:opacity-100",
      "peer-hover:helper-wait",
      "peer-focus-visible:opacity-100",
      "hover:opacity-100",
    );
    expect(helper().className).not.toMatch(/peer-focus-visible:helper-wait/);
  });

  it("takes another tab's choice while it stands", () => {
    render(<ThemeChoice />);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }),
      );
    });
    expect(root.getAttribute("data-theme")).toBe("dark");
  });
});

describe("the theme button's lab cell", () => {
  it("draws the look of its own cell, whatever the page's <html> notes", () => {
    root.setAttribute(THEME_CHOICE_ATTRIBUTE, "light");
    const { container } = render(
      <div data-theme="dark">
        <ThemeButtonCell state="pointed" width="phone" />
      </div>,
    );
    expect(iconsIn(themeButton())).toEqual(["sun"]);
    expect(themeButton()).toHaveAccessibleName("Switch to light theme");
    expect(themeButton()).toHaveAttribute("data-pointed");
    expect(helper()).toHaveTextContent("Light");
    expect(helper()).toHaveClass("opacity-100");
    expect(container.querySelector("[data-theme-helper]")).not.toHaveClass("hidden");
  });

  it("draws a moon and no helper at rest in a light cell, and the ring when focused", () => {
    const { unmount } = render(
      <div data-theme="light">
        <ThemeButtonCell state="rest" width="wide" />
      </div>,
    );
    expect(iconsIn(themeButton())).toEqual(["moon"]);
    expect(themeButton()).toHaveAccessibleName("Switch to dark theme");
    expect(helper()).toHaveClass("opacity-0");
    unmount();

    render(
      <div data-theme="light">
        <ThemeButtonCell state="focused" width="wide" />
      </div>,
    );
    expect(themeButton()).toHaveClass("outline-2", "outline-ink");
    expect(helper()).toHaveClass("opacity-100");
  });
});
