import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { daySlugOf } from "@/lib/days/address";
import { EXCERPT_REQUEST } from "@/lib/days/written/city-days";
import { writtenPool } from "./written-pool";
import { startExcerptOf, EXCERPT_STOPS } from "./start-excerpt";
import { INDEX_LABEL, StartExcerptView, StartIndex } from "./start-index";
import { startOffersOf } from "./start-offers";

const STARTS = startOffersOf(writtenPool());

class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());

describe("the start screen's index", () => {
  it("lists each written day by its city, country and day under its label, and opens one on a press", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<StartIndex starts={STARTS} onChoose={onChoose} />);
    const list = screen.getByRole("list", { name: INDEX_LABEL });
    expect(list.querySelectorAll("li")).toHaveLength(STARTS.length);
    const first = STARTS[0]!;
    const row = screen.getByRole("button", { name: new RegExp(`^${first.request.city}`) });
    expect(row).toHaveTextContent(first.country);
    await user.click(row);
    expect(onChoose).toHaveBeenCalledWith(first.request);
  });
});

describe("the start screen's excerpt", () => {
  it("holds the first stops of the excerpt's day, Barcelona's, and its address", () => {
    const excerpt = startExcerptOf(new Date())!;
    expect(excerpt.stops).toHaveLength(EXCERPT_STOPS);
    expect(excerpt.total).toBeGreaterThan(EXCERPT_STOPS);
    expect(excerpt.address).toBe(`/day/${daySlugOf(EXCERPT_REQUEST)}`);
    expect(excerpt.request.city).toBe("Barcelona");
  });

  it("shows them still, with nothing to press but the link to the whole day", () => {
    const excerpt = startExcerptOf(new Date())!;
    render(<StartExcerptView excerpt={excerpt} />);
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(EXCERPT_STOPS);
    expect(
      screen.getByRole("link", { name: `The whole day, ${excerpt.total} stops` }),
    ).toHaveAttribute("href", excerpt.address);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
