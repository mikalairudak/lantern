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
  it("names the list the day's plan, sets it first and says it is on show, none kept", () => {
    document.documentElement.removeAttribute(DAY_VIEW_ATTRIBUTE);
    render(
      <>
        <DayViewScript />
        <DayViewSwitch />
      </>,
    );
    expect(document.documentElement.getAttribute(DAY_VIEW_ATTRIBUTE)).toBe("read");
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Plan",
      "Chart",
    ]);
    expect(pressed()).toEqual(["Plan"]);
  });

  it("shows the chart on a press, keeps it for the next visit, and the plan on the next press", async () => {
    const user = userEvent.setup();
    document.documentElement.setAttribute(DAY_VIEW_ATTRIBUTE, "read");
    render(<DayViewSwitch />);

    await user.click(screen.getByRole("button", { name: "Chart" }));
    expect(document.documentElement.getAttribute(DAY_VIEW_ATTRIBUTE)).toBe("chart");
    expect(localStorage.getItem(DAY_VIEW_STORAGE_KEY)).toBe("chart");
    expect(pressed()).toEqual(["Chart"]);

    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(localStorage.getItem(DAY_VIEW_STORAGE_KEY)).toBe("read");
    expect(pressed()).toEqual(["Plan"]);
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
    expect(pressed()).toEqual(["Plan"]);

    // Another key changed is none of the view's business.
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "lantern.days.v1", newValue: "" }));
    });
    expect(pressed()).toEqual(["Plan"]);
  });
});
