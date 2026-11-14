import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { normalizeDay } from "@/lib/normalizer/normalize";
import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { TAKE_THIS_DAY } from "./day-menu";
import { DayStage } from "./day-stage";
import { NEW_DAY, NEW_DAY_NOTE, NewDayButton } from "./new-day";

/** jsdom has no layout, so the chart's container reports a laptop-sized box. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: 448, height: 640 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  // The visitor asks for reduced motion, as the e2e run does.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  }));
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => vi.unstubAllGlobals());

const ignore = () => undefined;

const KANAZAWA: Itinerary = (() => {
  const written = normalizeDay(KANAZAWA_START_REQUEST, KANAZAWA_START_DAY.day);
  if (!written.ok) throw new Error(written.reason);
  return written.itinerary;
})();

const headline = () => screen.getByRole("heading", { level: 1 });
const newDay = () => screen.getByRole("button", { name: NEW_DAY });
const field = () => screen.getByRole("textbox", { name: "Somewhere else" });

function renderDay() {
  const user = userEvent.setup();
  render(
    <DayStage
      request={KANAZAWA_START_REQUEST}
      partial={null}
      outcome={{ kind: "complete", itinerary: KANAZAWA }}
      isStreaming={false}
      isChosen={false}
      onPlay={ignore}
      onRetry={ignore}
    />,
  );
  return user;
}

describe("the new day's button", () => {
  it("is a button described by its menu row's line, with no popup of its own", () => {
    render(<NewDayButton onPress={ignore} />);
    expect(newDay()).toHaveAccessibleDescription(NEW_DAY_NOTE);
    expect(newDay()).not.toHaveAttribute("aria-haspopup");
    expect(newDay()).not.toHaveAttribute("aria-expanded");
    // In the row from `@masthead`, and with no script it stands aside.
    expect(newDay()).toHaveClass("hidden", "@masthead:inline-flex", "view-unset:hidden");
  });

  it("stands in the row at any width where there is no way along", () => {
    render(<NewDayButton onPress={ignore} isAlwaysInRow />);
    expect(newDay()).toHaveClass("inline-flex");
    expect(newDay()).not.toHaveClass("hidden");
  });

  it("locked, is muted with no hairline, marked so, and a press still tells", async () => {
    const onPress = vi.fn();
    render(<NewDayButton onPress={onPress} isLocked />);
    expect(newDay()).toHaveAttribute("aria-disabled", "true");
    expect(newDay()).toHaveClass("text-muted", "no-underline");
    await userEvent.click(newDay());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("the new day on a day's page", () => {
  it("opens the city word's list at its field, and Escape gives the focus to the city word", async () => {
    const user = renderDay();
    const city = within(headline()).getByRole("button", { name: "Kanazawa" });
    await user.click(newDay());
    expect(city).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(field()).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(city).toHaveAttribute("aria-expanded", "false"));
    expect(city).toHaveFocus();
  });

  it("pressed again with the list open, folds nothing and puts the focus back in the field", async () => {
    const user = renderDay();
    const city = within(headline()).getByRole("button", { name: "Kanazawa" });
    await user.click(newDay());
    await waitFor(() => expect(field()).toHaveFocus());
    const list = screen.getByRole("group", { name: "Where" });

    // The press lands on the button, outside the list: neither its press nor the focus leaving
    // the field for it closes the list.
    await user.click(newDay());
    expect(city).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Where" })).toBe(list);
    expect(field()).toHaveFocus();
  });

  it("moves the focus to the field when the list is open on its rows", async () => {
    const user = renderDay();
    const city = within(headline()).getByRole("button", { name: "Kanazawa" });
    await user.click(city);
    await waitFor(() => expect(city).toHaveAttribute("aria-expanded", "true"));
    await user.click(newDay());
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it("is the menu's last row too, which opens the field the same way", async () => {
    const user = renderDay();
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    // jsdom applies no container query, so the row's wrapper stays drawn: the short row's path.
    await user.click(screen.getByRole("menuitem", { name: /^New day/ }));
    await waitFor(() => expect(field()).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(within(headline()).getByRole("button", { name: "Kanazawa" })).toHaveFocus();
  });

  it("takes the focus when the menu leaves the page with it, as its last way goes", async () => {
    const user = userEvent.setup();
    const stage = (outcome: Parameters<typeof DayStage>[0]["outcome"]) => (
      <DayStage
        request={KANAZAWA_START_REQUEST}
        partial={null}
        outcome={outcome}
        isStreaming={false}
        isChosen={false}
        onPlay={ignore}
        onRetry={ignore}
      />
    );
    const { rerender } = render(stage({ kind: "complete", itinerary: KANAZAWA }));
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();

    act(() => rerender(stage({ kind: "refused" })));
    await waitFor(() => expect(screen.queryByRole("button", { name: TAKE_THIS_DAY })).toBeNull());
    await waitFor(() => expect(newDay()).toHaveFocus());
  });
});
