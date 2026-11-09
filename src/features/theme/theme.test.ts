import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THEME_CHOICE_ATTRIBUTE,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
  applyThemeChoice,
  readThemeChoice,
  restoreThemeChoice,
  serverThemeChoice,
  subscribeThemeChoice,
} from "./theme";

const root = document.documentElement;

afterEach(() => {
  root.removeAttribute("data-theme");
  root.removeAttribute(THEME_CHOICE_ATTRIBUTE);
  localStorage.clear();
  vi.restoreAllMocks();
});

/** The inline script as the browser runs it in <head>. */
function runThemeScript(): void {
  new Function(THEME_SCRIPT)();
}

describe("the theme script in <head>", () => {
  it("sets a stored light or dark theme on <html> before anything else runs", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runThemeScript();
    expect(root.getAttribute("data-theme")).toBe("dark");
    // The choice is noted for the theme's icon in the same moment.
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("dark");
  });

  it("leaves the system's theme when nothing, or something unknown, is stored", () => {
    runThemeScript();
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("system");
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    runThemeScript();
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("system");
  });

  it("keeps the system's theme when storage cannot be read, as in a private window", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(runThemeScript).not.toThrow();
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("system");
  });
});

describe("the theme choice", () => {
  it("reads what <html> carries, the system's when it carries nothing", () => {
    expect(readThemeChoice()).toBe("system");
    root.setAttribute("data-theme", "light");
    expect(readThemeChoice()).toBe("light");
    expect(serverThemeChoice()).toBe("system");
  });

  it("sets a chosen theme at once and keeps it; the system's clears both", () => {
    applyThemeChoice("dark");
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    applyThemeChoice("system");
    expect(root.hasAttribute("data-theme")).toBe(false);
    // The system's is a choice too, which the icon shows whatever the device resolves it to.
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("still sets the page's theme when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    applyThemeChoice("light");
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("tells subscribers of a choice on this page, and takes one made in another tab", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeThemeChoice(onChange);
    applyThemeChoice("light");
    expect(onChange).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }));
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("dark");
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: null }));
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("system");
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else", newValue: "x" }));
    expect(onChange).toHaveBeenCalledTimes(3);

    unsubscribe();
    applyThemeChoice("dark");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("goes back to the system's theme when another tab clears storage whole", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeThemeChoice(onChange);
    applyThemeChoice("dark");

    window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null }));
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("the theme restored where the head script did not run", () => {
  it("sets a stored theme and notes it, as the head script would have", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    restoreThemeChoice();
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("dark");
  });

  it("leaves a page the head script ran on as it is", () => {
    runThemeScript();
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    restoreThemeChoice();
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("system");
  });

  it("notes the system's theme when storage cannot be read, and tells every word", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const onChange = vi.fn();
    const unsubscribe = subscribeThemeChoice(onChange);
    restoreThemeChoice();
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe("system");
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
