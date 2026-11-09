import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isUncountedBrowser } from "@/lib/analytics/uncounted-browser";
import {
  COUNT_IT,
  COUNTED_LINE,
  DONT_COUNT_IT,
  UNCOUNTED_LINE,
  UncountedBrowser,
} from "./uncounted-browser";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("the studio's line on counting this browser", () => {
  it("marks the browser as the owner's when the studio opens, and says so", () => {
    render(<UncountedBrowser />);

    expect(isUncountedBrowser()).toBe(true);
    expect(screen.getByText(UNCOUNTED_LINE)).toBeVisible();
    expect(screen.getByRole("button", { name: COUNT_IT })).toBeVisible();
  });

  it("counts the browser again, and marks it back", async () => {
    const user = userEvent.setup();
    render(<UncountedBrowser />);

    await user.click(screen.getByRole("button", { name: COUNT_IT }));
    expect(isUncountedBrowser()).toBe(false);
    expect(screen.getByText(COUNTED_LINE)).toBeVisible();

    await user.click(screen.getByRole("button", { name: DONT_COUNT_IT }));
    expect(isUncountedBrowser()).toBe(true);
    expect(screen.getByText(UNCOUNTED_LINE)).toBeVisible();
  });

  it("says the browser is counted where its storage refuses the mark", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    render(<UncountedBrowser />);

    expect(screen.getByText(COUNTED_LINE)).toBeVisible();
  });

  it("draws nothing on the server, which cannot read the mark", () => {
    expect(renderToString(<UncountedBrowser />)).toBe("");
  });
});
