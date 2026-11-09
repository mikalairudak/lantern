import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DAY_VIEW_ATTRIBUTE, DAY_VIEW_STORAGE_KEY } from "./view-choice";
import { DayViewScript, DayViewSwitch } from "./view-switch";

afterEach(() => {
  document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
  localStorage.clear();
});

function pressed(): string[] {
  return screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent ?? "");
}

describe("the view's switch", () => {
  it("says the chart is on show once the page has set the view, none kept", () => {
    render(
      <>
        <DayViewScript />
        <DayViewSwitch />
      </>,
    );
    expect(document.documentElement.getAttribute(DAY_VIEW_ATTRIBUTE)).toBe("chart");
    expect(pressed()).toEqual(["Chart"]);
  });

  it("shows the list on a press, keeps it for the next visit, and the chart on the next press", async () => {
    const user = userEvent.setup();
    document.documentElement.setAttribute(DAY_VIEW_ATTRIBUTE, "chart");
    render(<DayViewSwitch />);

    await user.click(screen.getByRole("button", { name: "Read" }));
    expect(document.documentElement.getAttribute(DAY_VIEW_ATTRIBUTE)).toBe("read");
    expect(localStorage.getItem(DAY_VIEW_STORAGE_KEY)).toBe("read");
    expect(pressed()).toEqual(["Read"]);

    await user.click(screen.getByRole("button", { name: "Chart" }));
    expect(localStorage.getItem(DAY_VIEW_STORAGE_KEY)).toBeNull();
    expect(pressed()).toEqual(["Chart"]);
  });

  it("follows a view chosen in another tab", () => {
    document.documentElement.setAttribute(DAY_VIEW_ATTRIBUTE, "chart");
    render(<DayViewSwitch />);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: DAY_VIEW_STORAGE_KEY, newValue: "read" }),
      );
    });
    expect(document.documentElement.getAttribute(DAY_VIEW_ATTRIBUTE)).toBe("read");
    expect(pressed()).toEqual(["Read"]);

    // Another key changed is none of the view's business.
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "lantern.days.v1", newValue: "" }));
    });
    expect(pressed()).toEqual(["Read"]);
  });
});
