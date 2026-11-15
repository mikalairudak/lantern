import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { YourDay } from "./your-days";
import {
  FORGET_DAYS_QUESTION,
  FORGET_DAY_QUESTION,
  YourDaysLedger,
  type YourDaysLedgerProps,
} from "./your-days-ledger";
import { FORGET_YOUR_DAYS, YOUR_DAYS_HEADING } from "./your-days-list";

/** Sunday 15 November 2026, six in the evening in Alicante. */
const NOW = new Date("2026-11-15T17:00:00Z");

const scrollIntoView = vi.fn();
const SCROLL_INTO_VIEW = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterAll(() => {
  if (SCROLL_INTO_VIEW)
    Object.defineProperty(Element.prototype, "scrollIntoView", SCROLL_INTO_VIEW);
  else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

function dayOf(
  id: string,
  change: Partial<YourDay> = {},
  city = "Alicante",
  timezone = "Europe/Madrid",
): YourDay {
  return {
    id,
    request: {
      city,
      date: "2026-11-15",
      timezone,
      citySource: "chosen",
      energy: "social",
      energySource: "chosen",
      travel: "transit",
      start: "early",
      dinner: null,
      end: null,
      company: "friends",
    },
    startedAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
    energies: [],
    ending: "written",
    seconds: null,
    ...change,
  };
}

const FIVE = Array.from({ length: 5 }, (_, at) => dayOf(`day-${at}`));

function renderLedger(props: Partial<YourDaysLedgerProps> = {}) {
  const onOpen = vi.fn();
  const onForget = vi.fn();
  render(
    <YourDaysLedger days={[dayOf("a")]} now={NOW} onOpen={onOpen} onForget={onForget} {...props} />,
  );
  return { onOpen, onForget };
}

const rows = () =>
  within(screen.getByRole("list", { name: YOUR_DAYS_HEADING })).queryAllByRole("link");

describe("YourDaysLedger", () => {
  it("says nothing until the visitor has a day", () => {
    const { container } = render(
      <YourDaysLedger days={[]} now={NOW} onOpen={vi.fn()} onForget={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("names each row by its city, its words and its date, a link to the day's address", () => {
    renderLedger();

    const [row] = rows();
    expect(row).toHaveAccessibleName(
      "Alicante. Social Sunday, by public transport, early start, with friends. today",
    );
    expect(row).toHaveAttribute("href", "/day/a");
    expect(screen.getByRole("heading", { level: 2, name: YOUR_DAYS_HEADING })).toBeVisible();
  });

  it("opens a day at a plain press, and leaves a press with a modifier to the browser", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderLedger();
    const [row] = rows();

    const modified = fireEvent.click(row!, { ctrlKey: true });
    expect(modified).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();

    await user.click(row!);
    expect(onOpen).toHaveBeenCalledWith(dayOf("a"));
  });

  it("says how a day stands: writing in the date's place, how it ended after its words", () => {
    const old = new Date(NOW.getTime() - 40 * 86_400_000).toISOString();
    renderLedger({
      days: [
        dayOf("writing", { ending: "writing" }, "Elche"),
        dayOf("cut", { ending: "cut" }, "New York", "America/New_York"),
        dayOf("failed", { ending: "failed" }, "Madrid"),
        dayOf("expired", { startedAt: old }, "Amsterdam", "Europe/Amsterdam"),
      ],
      rowsAtRest: 3,
      isAllShownAtFirst: true,
    });

    const [writing, cut, failed, expired] = rows();
    expect(writing).toHaveAccessibleName(/\. writing$/);
    expect(within(writing!).getByText("Elche")).toHaveClass("word-lit");
    expect(cut).toHaveAccessibleName(/· cut short\. today$/);
    expect(failed).toHaveAccessibleName(/· not finished\. today$/);
    expect(expired).toHaveAccessibleName(/· link expired\. today$/);
    // No day behind it: the city and its rule in muted.
    expect(within(failed!).getByText("Madrid").parentElement).toHaveClass("text-muted");
    expect(within(expired!).getByText("Amsterdam").parentElement).toHaveClass("text-muted");
    expect(within(cut!).getByText("New York").parentElement).toHaveClass("text-ink");
  });

  it("says the day's own date, or when it was asked for when set to", () => {
    const later = dayOf("a", { startedAt: NOW.toISOString() });
    const days = [{ ...later, request: { ...later.request, date: "2026-11-21" } }];
    renderLedger({ days });
    expect(rows()[0]).toHaveAccessibleName(/\. 21 Nov$/);
    cleanup();

    renderLedger({ days, dateKind: "asked" });
    expect(rows()[0]).toHaveAccessibleName(/\. today$/);
  });

  it("shows the newest three, then all, then folds back with the focus on its button", async () => {
    const user = userEvent.setup();
    renderLedger({ days: FIVE });
    expect(rows()).toHaveLength(3);

    const fold = screen.getByRole("button", { name: "All your days · 5" });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    fold.focus();
    await user.keyboard("{Enter}");

    expect(rows()).toHaveLength(5);
    expect(rows()[3]).toHaveFocus();
    expect(fold).toHaveTextContent("Newest three");
    expect(fold).toHaveAttribute("aria-expanded", "true");

    await user.click(fold);
    expect(rows()).toHaveLength(3);
    expect(fold).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("keeps the folded days in the grid for its widths alone, unheard and out of reach", async () => {
    const user = userEvent.setup();
    const cities = ["Alicante", "Elche", "Seoul", "Amsterdam", "New York"];
    renderLedger({ days: cities.map((city, at) => dayOf(`day-${at}`, {}, city)) });
    const list = () => within(screen.getByRole("list", { name: YOUR_DAYS_HEADING }));

    // Three rows heard; the two folded cities stand in the list only to size its columns.
    expect(list().getAllByRole("listitem")).toHaveLength(3);
    const sizer = screen.getByText("Amsterdam").closest("li");
    expect(sizer).toHaveAttribute("aria-hidden", "true");
    expect(sizer).toHaveTextContent("today");
    expect(sizer!.querySelector("a, button, [tabindex]")).toBeNull();
    expect(screen.getByText("New York").closest("li")).toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByRole("button", { name: "All your days · 5" }));
    expect(list().getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getAllByText("Amsterdam")).toHaveLength(1);
    expect(screen.getByText("Amsterdam").closest("li")).not.toHaveAttribute("aria-hidden");
  });

  it("draws no fold for three days or fewer, and folds to one when one stands at rest", async () => {
    const user = userEvent.setup();
    renderLedger({ days: FIVE.slice(0, 3) });
    expect(screen.queryByRole("button", { name: /All your days/ })).not.toBeInTheDocument();
    cleanup();

    renderLedger({ days: FIVE, rowsAtRest: 1 });
    expect(rows()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "All your days · 5" }));
    expect(rows()[1]).toHaveFocus();
    expect(screen.getByRole("button", { name: "Newest day" })).toBeInTheDocument();
  });

  it("asks once before it forgets, with the focus on Keep, and keeps at Keep or Escape", async () => {
    const user = userEvent.setup();
    const { onForget } = renderLedger({ days: FIVE });

    await user.click(screen.getByRole("button", { name: FORGET_YOUR_DAYS }));
    // The question names its two answers' group, so the answer under the focus is heard with it.
    const asked = screen.getByRole("group", { name: FORGET_DAYS_QUESTION });
    expect(within(asked).getByRole("button", { name: "Keep" })).toHaveFocus();
    expect(within(asked).getByRole("button", { name: "Forget" })).toBeInTheDocument();
    // The list keeps its name while the question stands.
    expect(screen.getByRole("list", { name: YOUR_DAYS_HEADING })).toBeInTheDocument();
    expect(onForget).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(screen.queryByText(FORGET_DAYS_QUESTION)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: FORGET_YOUR_DAYS })).toHaveFocus();

    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getByRole("button", { name: FORGET_YOUR_DAYS })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: FORGET_YOUR_DAYS }));
    await user.click(screen.getByRole("button", { name: "Forget" }));
    expect(onForget).toHaveBeenCalledOnce();
  });

  it("asks of one day as one day, and forgets at one press when set not to ask", async () => {
    const user = userEvent.setup();
    renderLedger({ still: { isForgetAsking: true } });
    expect(screen.getByText(FORGET_DAY_QUESTION)).toBeInTheDocument();
    cleanup();

    const { onForget } = renderLedger({ isForgetAsked: false });
    await user.click(screen.getByRole("button", { name: FORGET_YOUR_DAYS }));
    expect(onForget).toHaveBeenCalledOnce();
  });

  it("draws the energy's scale in each row only when asked to, unheard", () => {
    renderLedger();
    expect(rows()[0]!.querySelector("svg")).toBeNull();
    cleanup();

    renderLedger({ hasEnergyWire: true });
    const [row] = rows();
    expect(row!.querySelectorAll("svg")).toHaveLength(2);
    expect(row).toHaveAccessibleName(
      "Alicante. Social Sunday, by public transport, early start, with friends. today",
    );
  });

  it("draws a row pointed at, focused, or a day written under reduced motion, still", () => {
    renderLedger({
      days: [dayOf("a"), dayOf("b"), dayOf("c", { ending: "writing" }, "Elche")],
      still: { pointedRow: 0, focusedRow: 1, isMotionReduced: true },
    });

    const [pointed, focused, writing] = rows();
    expect(pointed).toHaveAttribute("data-pointed");
    expect(pointed).not.toHaveClass("outline-2");
    // Focused, the row shows all a pointer shows, the city's heavier rule, and the ring besides.
    expect(focused).toHaveAttribute("data-pointed");
    expect(focused).toHaveClass("outline-2", "-outline-offset-2", "outline-ink");
    expect(within(writing!).getByText("Elche")).not.toHaveClass("word-lit");
  });
});
