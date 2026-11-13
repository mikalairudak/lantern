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

describe("a theme chosen on the page", () => {
  /** The crossings the page began, each waiting for the browser to set its theme. */
  let crossings: (() => void)[] = [];

  /** A browser with view transitions, a device in `scheme` and motion as `motion` sets it. */
  function stubBrowser({
    scheme = "light",
    motion = "no-preference",
    hasViewTransitions = true,
  }: {
    scheme?: "light" | "dark";
    motion?: "reduce" | "no-preference";
    hasViewTransitions?: boolean;
  }): void {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches:
        query === `(prefers-color-scheme: ${scheme})` ||
        query === `(prefers-reduced-motion: ${motion})`,
    }));
    if (!hasViewTransitions) return;
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: vi.fn((update: () => void) => {
        crossings.push(update);
      }),
    });
  }

  /** The browser takes its old picture and calls each crossing's update, in order. */
  function runCrossings(): void {
    for (const update of crossings.splice(0)) update();
  }

  afterEach(() => {
    crossings = [];
    Reflect.deleteProperty(document, "startViewTransition");
    vi.unstubAllGlobals();
  });

  it.each([
    ["light", "dark", "light"],
    ["dark", "light", "light"],
    ["light", "system", "dark"],
    ["dark", "system", "light"],
  ] as const)(
    "crosses from %s to %s on a %s device, setting the theme only in the crossing",
    (from, to, scheme) => {
      stubBrowser({ scheme });
      root.setAttribute("data-theme", from);
      applyThemeChoice(to);

      expect(document.startViewTransition).toHaveBeenCalledTimes(1);
      // Kept at once; the page keeps its look until the browser has its old picture.
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(to === "system" ? null : to);
      expect(root.getAttribute("data-theme")).toBe(from);
      runCrossings();
      expect(readThemeChoice()).toBe(to);
      expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe(to);
    },
  );

  it.each([
    ["system", "light", "light"],
    ["light", "system", "light"],
    ["system", "dark", "dark"],
    ["dark", "dark", "light"],
  ] as const)(
    "sets %s to %s at once on a %s device, where no colour changes",
    (from, to, scheme) => {
      stubBrowser({ scheme });
      if (from !== "system") root.setAttribute("data-theme", from);
      applyThemeChoice(to);
      expect(document.startViewTransition).not.toHaveBeenCalled();
      expect(readThemeChoice()).toBe(to);
      expect(root.getAttribute(THEME_CHOICE_ATTRIBUTE)).toBe(to);
    },
  );

  it("sets a theme at once under reduced motion", () => {
    stubBrowser({ motion: "reduce" });
    applyThemeChoice("dark");
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it("sets a theme at once where the browser has no view transitions", () => {
    stubBrowser({ hasViewTransitions: false });
    applyThemeChoice("dark");
    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it("tells every word once the crossing sets the theme, not before", () => {
    stubBrowser({});
    const onChange = vi.fn();
    const unsubscribe = subscribeThemeChoice(onChange);
    applyThemeChoice("dark");
    expect(onChange).not.toHaveBeenCalled();
    runCrossings();
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("leaves the last of two quick choices standing, whatever order the browser sets them in", () => {
    stubBrowser({});
    root.setAttribute("data-theme", "light");
    applyThemeChoice("dark");
    // The second comes before the first has set its theme, and changes nothing seen: at once.
    applyThemeChoice("light");
    expect(root.getAttribute("data-theme")).toBe("light");
    runCrossings();
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("takes another tab's choice at once", () => {
    stubBrowser({});
    const unsubscribe = subscribeThemeChoice(() => undefined);
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }));
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(root.getAttribute("data-theme")).toBe("dark");
    unsubscribe();
  });

  it("holds every colour still while the page's style takes the new theme", () => {
    stubBrowser({ hasViewTransitions: false });
    const heldAtLayout: boolean[] = [];
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(() => {
      heldAtLayout.push(
        root.hasAttribute("data-theme-still") && root.getAttribute("data-theme") === "dark",
      );
      return 0;
    });
    applyThemeChoice("dark");
    expect(heldAtLayout).toEqual([true]);
    expect(root.hasAttribute("data-theme-still")).toBe(false);
  });
});
