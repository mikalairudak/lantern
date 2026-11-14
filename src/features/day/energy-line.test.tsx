import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { KANAZAWA_START_REQUEST } from "@/lib/days/written/quick-starts";
import { answerDayRequest } from "@/lib/stream/answer-day-request";
import { Day } from "./day";
import { PLACES } from "./energy-glyph";
import { repickLineOf } from "./not-yet";
import { READING_LIST_LABEL } from "./reading-list";

/**
 * The line under each answer of the energy word's list against what its press then does: the
 * stops it says it re-picks are the stops whose place changes, on Kanazawa's written day as
 * landed and after each way the visitor can change what it shows.
 */

const ORIGIN = "http://lantern.test";
const DAY_TIMEOUT = { timeout: 5000 };
/** Kanazawa's day is calm; after an earlier level, lively. */
const LANDED_LEVEL = "calm";
const EARLIER_LEVEL = "lively";
const LEVELS = ["quiet", "calm", "balanced", "lively", "social"] as const;
type Level = (typeof LEVELS)[number];
/** A row's buttons that show another version of its stop. */
const ARROW_NAME = /^(Quieter|Livelier|Same energy): /;

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

/** The visitor asks for reduced motion: only the stream takes time. */
function reducedMotion(query: string): MediaQueryList {
  return {
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.stubGlobal("matchMedia", reducedMotion);
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string, init: RequestInit) =>
      answerDayRequest(new Request(new URL(path, ORIGIN), init), { deltaChars: 64 }),
    ),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.scrollBy = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;

const headline = () => screen.getByRole("heading", { level: 1 });
const planRows = () =>
  within(screen.getByRole("list", { name: READING_LIST_LABEL })).getAllByRole("listitem");

/** Waits until the day is written and still, when its words and versions can be changed. */
async function waitForTheDay(): Promise<void> {
  await waitFor(
    () =>
      expect(screen.getByRole("group", { name: /The day's energy/ })).toHaveAttribute(
        "aria-busy",
        "false",
      ),
    DAY_TIMEOUT,
  );
}

/** The place each stop shows, as its row on the plan names it. */
function shownNames(): string[] {
  return planRows().map((row) => within(row).getByRole("heading").textContent ?? "");
}

/** Kanazawa's written day, landed and read on its plan. */
async function landOnThePlan(): Promise<User> {
  const user = userEvent.setup();
  render(<Day first={KANAZAWA_START_REQUEST} />);
  await waitForTheDay();
  await user.click(
    within(screen.getByRole("group", { name: "View" })).getByRole("button", { name: "Plan" }),
  );
  await waitFor(() => expect(planRows().length).toBeGreaterThan(0), DAY_TIMEOUT);
  return user;
}

/** Shows another version of the stops in these rows of the plan, each by its first arrow. */
async function swapRows(user: User, count: number): Promise<void> {
  const swappable = planRows().filter(
    (row) => within(row).queryAllByRole("button", { name: ARROW_NAME }).length > 0,
  );
  expect(swappable.length).toBeGreaterThanOrEqual(count);
  for (const row of swappable.slice(0, count)) {
    await user.click(within(row).getAllByRole("button", { name: ARROW_NAME })[0]!);
  }
}

/** Opens the headline's energy word, says what an answer's line reads, and chooses it. */
async function chooseEnergy(user: User, from: Level, to: Level): Promise<string> {
  await user.click(within(headline()).getByRole("button", { name: from }));
  const option = screen.getByRole("option", { name: to });
  const noteId = option.getAttribute("aria-describedby");
  const line = noteId === null ? "" : (document.getElementById(noteId)?.textContent ?? "");
  await user.click(option);
  return line;
}

/** How many stops show another place than before. */
const differing = (before: readonly string[], after: readonly string[]) =>
  before.filter((name, index) => after[index] !== name).length;

interface Scenario {
  name: string;
  /** The day's level once the scenario is set. */
  level: Level;
  /** Changes what the day shows from how it landed. */
  set: (user: User) => Promise<void>;
}

const SCENARIOS: readonly Scenario[] = [
  { name: "as landed", level: LANDED_LEVEL, set: async () => undefined },
  { name: "with one stop swapped", level: LANDED_LEVEL, set: (user) => swapRows(user, 1) },
  { name: "with three stops swapped", level: LANDED_LEVEL, set: (user) => swapRows(user, 3) },
  {
    name: "after the curve was pulled at a stop",
    level: LANDED_LEVEL,
    // A stop's keys bend the curve as a drag there does: its liveliest version, neighbours
    // following as far as the pull reaches them.
    set: async (user) => {
      screen.getAllByRole("slider")[1]!.focus();
      await user.keyboard("{End}");
    },
  },
  {
    name: "after an earlier level was chosen",
    level: EARLIER_LEVEL,
    set: async (user) => {
      await chooseEnergy(user, LANDED_LEVEL, EARLIER_LEVEL);
    },
  },
];

const CASES = SCENARIOS.flatMap((scenario) =>
  LEVELS.filter((level) => level !== scenario.level).map((to) => ({ scenario, to })),
);

describe("the energy word's list", () => {
  it("draws each answer's place on the scale on its row, the day's bead in energy's colour", async () => {
    const user = await landOnThePlan();
    await user.click(within(headline()).getByRole("button", { name: LANDED_LEVEL }));

    const options = screen.getAllByRole("option");
    options.forEach((option, index) => {
      const bead = option.querySelector("svg[aria-hidden] [data-bead]");
      expect(Number(bead?.getAttribute("cx"))).toBe(PLACES[index]);
      const isDay = option.getAttribute("aria-selected") === "true";
      expect(bead).toHaveClass(isDay ? "fill-energy" : "fill-current");
    });
    // Each answer is still named by its level alone, the glyph unheard, quiet first.
    LEVELS.forEach((level, index) =>
      expect(screen.getByRole("option", { name: level })).toBe(options[index]),
    );
  });
});

describe("the energy word's list, against what its press does", () => {
  it.each(CASES)(
    "counts the stops $to re-picks $scenario.name",
    async ({ scenario, to }) => {
      const user = await landOnThePlan();
      const landed = shownNames();
      await scenario.set(user);
      await waitForTheDay();
      const before = shownNames();
      if (scenario.name !== "as landed") expect(before).not.toEqual(landed);

      const line = await chooseEnergy(user, scenario.level, to);
      await waitForTheDay();
      const after = shownNames();

      expect(line).toBe(repickLineOf(differing(before, after), before.length));
    },
    15_000,
  );
});
