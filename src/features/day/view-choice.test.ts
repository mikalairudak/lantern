import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DAY_VIEW_ATTRIBUTE,
  dayViewScriptOf,
  DAY_VIEW_STORAGE_KEY,
  applyDayView,
  readDayView,
  restoreDayView,
  subscribeDayView,
} from "./view-choice";

afterEach(() => {
  document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
  localStorage.clear();
});

describe("the day's view", () => {
  it("is the plan where nothing set it, as a page read without its script", () => {
    document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
    expect(readDayView()).toBe("read");
  });

  it("opens a day on its plan from the head script, unless the visitor chose the chart", () => {
    new Function(dayViewScriptOf())();
    expect(readDayView()).toBe("read");

    // A choice of the chart, kept from a visit when the chart came first, still wins.
    localStorage.setItem(DAY_VIEW_STORAGE_KEY, "chart");
    new Function(dayViewScriptOf())();
    expect(readDayView()).toBe("chart");

    localStorage.setItem(DAY_VIEW_STORAGE_KEY, "read");
    new Function(dayViewScriptOf())();
    expect(readDayView()).toBe("read");
  });

  it("opens a day on its plan where storage cannot be read", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    new Function(dayViewScriptOf())();
    expect(readDayView()).toBe("read");
    document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
    restoreDayView();
    expect(readDayView()).toBe("read");
    getItem.mockRestore();
  });

  it("keeps the visitor's choice for the next visit and tells the page", () => {
    const onChange = vi.fn();
    const stop = subscribeDayView(onChange);

    applyDayView("read");
    expect(readDayView()).toBe("read");
    expect(localStorage.getItem(DAY_VIEW_STORAGE_KEY)).toBe("read");
    applyDayView("chart");
    // Kept by its value, so it holds whichever view a day opens on.
    expect(localStorage.getItem(DAY_VIEW_STORAGE_KEY)).toBe("chart");
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });

  it("reads a choice cleared in another tab as the view a day opens on", () => {
    const stop = subscribeDayView(() => undefined);
    window.dispatchEvent(
      new StorageEvent("storage", { key: DAY_VIEW_STORAGE_KEY, newValue: "chart" }),
    );
    expect(readDayView()).toBe("chart");
    window.dispatchEvent(
      new StorageEvent("storage", { key: DAY_VIEW_STORAGE_KEY, newValue: null }),
    );
    expect(readDayView()).toBe("read");
    stop();
  });

  it("restores the stored choice on a page the head script did not run on", () => {
    document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
    localStorage.setItem(DAY_VIEW_STORAGE_KEY, "chart");
    restoreDayView();
    expect(readDayView()).toBe("chart");
  });
});
