import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DAY_VIEW_ATTRIBUTE,
  DAY_VIEW_SCRIPT,
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
  it("is the list where nothing set it, as a page read without its script", () => {
    document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
    expect(readDayView()).toBe("read");
  });

  it("is the chart from the head script, unless the visitor chose the list", () => {
    new Function(DAY_VIEW_SCRIPT)();
    expect(readDayView()).toBe("chart");

    localStorage.setItem(DAY_VIEW_STORAGE_KEY, "read");
    new Function(DAY_VIEW_SCRIPT)();
    expect(readDayView()).toBe("read");
  });

  it("keeps the visitor's choice for the next visit and tells the page", () => {
    const onChange = vi.fn();
    const stop = subscribeDayView(onChange);

    applyDayView("read");
    expect(readDayView()).toBe("read");
    expect(localStorage.getItem(DAY_VIEW_STORAGE_KEY)).toBe("read");
    applyDayView("chart");
    expect(localStorage.getItem(DAY_VIEW_STORAGE_KEY)).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });

  it("restores the stored choice on a page the head script did not run on", () => {
    document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
    localStorage.setItem(DAY_VIEW_STORAGE_KEY, "read");
    restoreDayView();
    expect(readDayView()).toBe("read");
  });
});
