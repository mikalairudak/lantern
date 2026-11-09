import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OPEN_IT_AGAIN, PAGE_FAILED, PLAN_YOUR_OWN, PageFailed } from "./page-failed";

/** The tab's title as the page it took the place of had it. */
const PAGE_TITLE = "A quiet Saturday in Nafplio, slow morning · Lantern";

/** The tab's title as the page the visitor goes on to names it. */
const NEXT_PAGE_TITLE = "Privacy and terms · Lantern";

describe("the page for a failure", () => {
  it("says the page could not be opened, as Lantern's own page", () => {
    render(<PageFailed onRetry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(PAGE_FAILED);
    // The wordmark leads home, and the page ends with Lantern's last line.
    expect(screen.getByRole("link", { name: "Lantern" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Privacy and terms");
  });

  it("asks for the page again", async () => {
    const onRetry = vi.fn();
    render(<PageFailed onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: OPEN_IT_AGAIN }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("leads back to the start screen", () => {
    render(<PageFailed onRetry={vi.fn()} />);

    expect(screen.getByRole("link", { name: PLAN_YOUR_OWN })).toHaveAttribute("href", "/");
  });

  it("names itself in the tab, and gives the tab back once the page comes back", () => {
    document.title = PAGE_TITLE;
    const { unmount } = render(<PageFailed onRetry={vi.fn()} />);

    expect(document.title).toBe("A page Lantern couldn't open · Lantern");

    unmount();
    expect(document.title).toBe(PAGE_TITLE);
  });

  it("leaves the tab to the page the visitor goes on to by a link", () => {
    document.title = PAGE_TITLE;
    const { unmount } = render(<PageFailed onRetry={vi.fn()} />);

    // The next page names the tab before this one is gone, as a link to Privacy and terms does.
    document.title = NEXT_PAGE_TITLE;
    unmount();

    expect(document.title).toBe(NEXT_PAGE_TITLE);
  });
});
