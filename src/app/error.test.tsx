import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OPEN_IT_AGAIN, PAGE_FAILED } from "@/features/day/page-failed";
import ErrorPage from "./error";

/** What a failure carries, which a visitor never sees. */
const MESSAGE = "Cannot read properties of undefined (reading 'stops')";
const DIGEST = "2913472814";

function failure(): Error {
  const error = new Error(MESSAGE);
  error.name = "TypeError";
  return Object.assign(error, { digest: DIGEST });
}

describe("a page that fails", () => {
  it("shows Lantern's page for a failure, and nothing of what failed", () => {
    render(<ErrorPage error={failure()} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(PAGE_FAILED);
    for (const detail of [MESSAGE, DIGEST, "TypeError", "Error"]) {
      expect(document.body).not.toHaveTextContent(detail);
    }
  });

  it("draws the page again when asked", async () => {
    const retry = vi.fn();
    render(<ErrorPage error={failure()} retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: OPEN_IT_AGAIN }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
