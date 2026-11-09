import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KYOTO_REQUEST, LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import type { YourDay } from "./your-days";
import { FORGET_YOUR_DAYS, YOUR_DAYS_HEADING, YourDaysList, yourDayNoteOf } from "./your-days-list";

/** Saturday evening in the visitor's own calendar. */
const NOW = new Date(2026, 9, 31, 21, 0);

function dayOf(change: Partial<YourDay> = {}): YourDay {
  return {
    id: "a",
    request: LISBON_REQUEST,
    startedAt: new Date(2026, 9, 31, 20, 30).toISOString(),
    energies: ["lively", "social", "balanced"],
    ending: "written",
    seconds: 46,
    ...change,
  };
}

describe("yourDayNoteOf", () => {
  it("says how far a day is written while it is", () => {
    expect(yourDayNoteOf(dayOf({ ending: "writing", energies: [] }), NOW)).toBe("writing");
    expect(yourDayNoteOf(dayOf({ ending: "writing", energies: ["calm"] }), NOW)).toBe(
      "writing · 1\u00A0stop so far",
    );
    expect(yourDayNoteOf(dayOf({ ending: "writing" }), NOW)).toBe("writing · 3\u00A0stops so far");
  });

  it("says when a day was asked for, by the visitor's calendar, and how it ended", () => {
    expect(yourDayNoteOf(dayOf(), NOW)).toBe("today");
    const yesterday = new Date(2026, 9, 30, 23, 50).toISOString();
    expect(yourDayNoteOf(dayOf({ startedAt: yesterday, ending: "cut" }), NOW)).toBe(
      "yesterday · cut short",
    );
    const lastWeek = new Date(2026, 9, 24, 9, 0).toISOString();
    expect(yourDayNoteOf(dayOf({ startedAt: lastWeek, ending: "failed" }), NOW)).toBe(
      "Sat 24 Oct · not finished",
    );
  });
});

describe("YourDaysList", () => {
  it("says nothing until the visitor has a day", () => {
    const { container } = render(
      <YourDaysList days={[]} now={NOW} onOpen={vi.fn()} onForget={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("lists each day by its shape, its sentence and how it stands, and opens one pressed", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const writing = dayOf({ id: "b", request: KYOTO_REQUEST, ending: "writing", energies: [] });
    render(<YourDaysList days={[writing, dayOf()]} now={NOW} onOpen={onOpen} onForget={vi.fn()} />);

    const days = within(screen.getByRole("list", { name: YOUR_DAYS_HEADING }));
    expect(days.getAllByRole("button").map((day) => day.textContent)).toEqual([
      "A calm Saturday in Kyoto. writing",
      "A lively Saturday in Lisbon, with friends. today",
    ]);
    // A day still with no stop has a shape with no bead yet.
    expect(days.getAllByRole("button")[0]!.querySelectorAll("circle")).toHaveLength(0);

    await user.click(days.getByRole("button", { name: /Lisbon/ }));
    expect(onOpen).toHaveBeenCalledWith(dayOf());
  });

  it("shows the newest three until all are asked for", async () => {
    const user = userEvent.setup();
    const days = Array.from({ length: 5 }, (_, at) => dayOf({ id: `day-${at}` }));
    render(<YourDaysList days={days} now={NOW} onOpen={vi.fn()} onForget={vi.fn()} />);
    const list = () => within(screen.getByRole("list", { name: YOUR_DAYS_HEADING }));

    expect(list().getAllByRole("button")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "All your days · 5" }));

    expect(list().getAllByRole("button")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /All your days/ })).not.toBeInTheDocument();
  });

  it("forgets the days in this browser", async () => {
    const user = userEvent.setup();
    const onForget = vi.fn();
    render(<YourDaysList days={[dayOf()]} now={NOW} onOpen={vi.fn()} onForget={onForget} />);

    await user.click(screen.getByRole("button", { name: FORGET_YOUR_DAYS }));

    expect(onForget).toHaveBeenCalledOnce();
  });
});
