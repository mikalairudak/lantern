import { afterEach, describe, expect, it, vi } from "vitest";
import { OWNER_BROWSER_STORAGE } from "@/lib/browser-storage";
import {
  isUncountedBrowser,
  markUncountedBrowser,
  subscribeUncountedBrowser,
} from "./uncounted-browser";

const MARK_KEY = OWNER_BROWSER_STORAGE.uncounted.key;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function refused(): never {
  throw new DOMException("The operation is insecure.", "SecurityError");
}

describe("the owner's mark", () => {
  it("counts a browser until it is marked, and again once the mark is taken back", () => {
    expect(isUncountedBrowser()).toBe(false);

    markUncountedBrowser(true);
    expect(isUncountedBrowser()).toBe(true);

    markUncountedBrowser(false);
    expect(isUncountedBrowser()).toBe(false);
  });

  it("takes any value at its key as the mark", () => {
    localStorage.setItem(MARK_KEY, "yes");

    expect(isUncountedBrowser()).toBe(true);
  });

  it("counts a browser whose storage throws, is missing, or cannot be reached", () => {
    expect(isUncountedBrowser({ getItem: refused })).toBe(false);
    expect(isUncountedBrowser(null)).toBe(false);

    localStorage.setItem(MARK_KEY, "1");
    vi.spyOn(window, "localStorage", "get").mockImplementation(refused);
    expect(isUncountedBrowser()).toBe(false);
  });

  it("never throws when the storage refuses the mark", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(refused);

    expect(() => markUncountedBrowser(true)).not.toThrow();
    expect(isUncountedBrowser()).toBe(false);
  });

  it("tells a listener when it changes on this page or in another tab, and stops when asked", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeUncountedBrowser(onChange);

    markUncountedBrowser(true);
    window.dispatchEvent(new StorageEvent("storage", { key: MARK_KEY }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    window.dispatchEvent(new StorageEvent("storage", { key: "lantern.days.v1" }));
    expect(onChange).toHaveBeenCalledTimes(3);

    unsubscribe();
    markUncountedBrowser(false);
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
