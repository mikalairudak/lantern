import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FAILED_NOTE, READING_NOTE } from "@/features/itinerary/use-still";
import { CHART } from "./geometry";
import { rowScale } from "./rows";
import { ONLY_STOP_NEVER_PROPOSED, StopRowCell, cellFrameOf } from "./stop-row-cell";
import { STOP_ROW_EXAMPLES, itineraryOf } from "./stop-row-examples";

/**
 * How full and how loud a place is, as the second line of a row that does not open says it
 * ("busy · chatter"), read from the finished day the example is in.
 */
function feelOf(label: string, name: string): string {
  const example = STOP_ROW_EXAMPLES.find((each) => each.label === label);
  if (!example) throw new Error(`No example "${label}"`);
  const place = itineraryOf(example.fixture).stops.find(({ primary }) => primary.name === name);
  if (!place) throw new Error(`No place "${name}" in "${label}"`);
  return `${place.primary.sensory.crowd} · ${place.primary.sensory.acoustic}`;
}

/**
 * The still every cell reads while a test sets one, as the examples' cache gives one promise
 * per cell; null, they read as they do.
 */
const failure = vi.hoisted(() => ({ still: null as Promise<never> | null }));

vi.mock("./stop-row-examples", async (importOriginal) => {
  const examples = await importOriginal<typeof import("./stop-row-examples")>();
  return {
    ...examples,
    stillOf: (...args: Parameters<typeof examples.stillOf>) =>
      failure.still ?? examples.stillOf(...args),
  };
});

const CELL_WIDTH = 390;
const MINUTES_PER_HOUR = 60;
const hours = (count: number) => count * MINUTES_PER_HOUR;

/** jsdom has no layout, so the cell reports a phone's width. */
class FixedSizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    const entry = { contentRect: { width: CELL_WIDTH, height: 0 } };
    this.callback([entry as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", FixedSizeObserver);
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
afterEach(() => {
  failure.still = null;
});

/** The list of the cell's day, once its frame of the stream is read. */
async function dayList(): Promise<HTMLElement> {
  return screen.findByRole("list", { name: "The day" });
}

describe("StopRowCell", () => {
  it("reads its frame of the stream first, then shows the stop between its neighbours", async () => {
    render(<StopRowCell example={0} state="complete" density={null} />);

    expect(screen.getByText(READING_NOTE)).toBeInTheDocument();
    const list = await dayList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByRole("button", { name: /^Playa del Postiguet/ })).toBeInTheDocument();
  });

  it("says so when its frames of the stream fail to read, rather than reading for good", async () => {
    failure.still = Promise.reject(new Error("A stop row example does not normalize"));
    // Read by the cell; marked handled so the runner does not report it before then.
    failure.still.catch(() => undefined);
    render(<StopRowCell example={0} state="placed" density={null} />);

    expect(
      await screen.findByText(`${FAILED_NOTE} A stop row example does not normalize`),
    ).toBeInTheDocument();
    expect(screen.queryByText(READING_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "The day" })).not.toBeInTheDocument();
  });

  it("refuses an example the matrix does not have", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      render(<StopRowCell example={STOP_ROW_EXAMPLES.length} state="placed" density={null} />),
    ).toThrow(`The stop row has no example ${STOP_ROW_EXAMPLES.length}`);
    vi.mocked(console.error).mockRestore();
  });

  it("shows a stop placed in time before its name is written", async () => {
    render(<StopRowCell example={1} state="placed" density={null} />);

    const list = await dayList();
    expect(within(list).getByText("Castillo de Santa Bárbara")).toBeInTheDocument();
    expect(within(list).queryByText("Mercado Central")).not.toBeInTheDocument();
    // Its time is final once it is placed, so it says when before it says where.
    expect(await within(list).findByText("12:00")).toBeInTheDocument();
  });

  it("draws a proposal's stop compact and blue beside the day, nothing of it to open", async () => {
    render(<StopRowCell example={0} state="proposed" density={null} />);

    const row = await screen.findByRole("button", { name: /^Playa del Postiguet/ });
    const time = row.closest("li")?.querySelector("[data-start-time]");
    // Its name and its time in the versions' blue, its name and kind alone.
    expect(within(row).getByText(/^Playa del Postiguet/)).toHaveClass("text-swap");
    expect(time).toHaveClass("text-swap");
    expect(row.querySelector(".type-prose")).toBeNull();
    // No sun of its own until it is taken, and nothing to open.
    expect(row.querySelector(".lucide-sunrise, .lucide-sunset")).toBeNull();
    expect(row).toBeDisabled();
    // On the chart, a hollow bead ringed in blue on a dashed wire, a dashed curve through it.
    expect(document.querySelector("[data-proposal-path]")).not.toBeNull();
    // Its neighbour stays the day's, in its ink.
    const other = screen.getByRole("button", { name: /^Barrio de Santa Cruz/ });
    expect(within(other).getByText(/^Barrio de Santa Cruz/)).toHaveClass("text-ink");
  });

  it("says a day of one stop never has it proposed beside it, rather than draw it with no day", async () => {
    const only = STOP_ROW_EXAMPLES.findIndex(({ label }) => label === "one version only");
    render(<StopRowCell example={only} state="proposed" density={null} />);

    expect(await screen.findByText(ONLY_STOP_NEVER_PROPOSED)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("opens the stop's sheet, and a press elsewhere leaves it open", async () => {
    const user = userEvent.setup();
    render(<StopRowCell example={0} state="open" density={null} />);

    const sheet = await screen.findByRole("region", { name: /^About Playa del Postiguet/ });
    await user.click(document.body);
    expect(sheet).toBeInTheDocument();
  });

  it("keeps a layer over its sheet for the beads above it, out of any hand's way", async () => {
    // Alicante's fourth stop, under the third's wire.
    render(<StopRowCell example={1} state="open" density={null} />);
    await screen.findByRole("region", { name: /^About / });

    // jsdom lays out no words, so whether the sheet reaches the beads is left to the band's
    // own test: here, that the layer they are drawn into is a picture only.
    const layer = document.querySelector("svg.z-20");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("pointer-events-none");
  });

  it("puts the stop's next version in, as a visitor would", async () => {
    render(<StopRowCell example={0} state="swapped" density={null} />);

    const list = await dayList();
    await waitFor(() =>
      expect(within(list).queryByText("Playa del Postiguet")).not.toBeInTheDocument(),
    );
  });

  it("says only a stop's name and kind while it waits for its energy", async () => {
    render(<StopRowCell example={0} state="unweighed" density={null} />);

    const list = await dayList();
    const stop = within(list).getByRole("button", { name: /^Playa del Postiguet/ });
    // It grows once weighed rather than saying its neighbourhood now and folding it later.
    expect(stop).toHaveTextContent(/^Playa del Postiguetviewpoint$/);
  });

  it("says a weighed stop's words and texture whole when they are there at once", async () => {
    render(<StopRowCell example={0} state="complete" density={null} />);

    const list = await dayList();
    const stop = within(list).getByRole("button", { name: /^Playa del Postiguet/ });
    // Its name says its quarter, Postiguet, so its row says its kind alone.
    expect(stop).toHaveTextContent(/^Playa del Postiguetviewpoint/);
    expect(within(stop).getByText("Small waves, a beach rake, gulls.")).toBeInTheDocument();
    expect(stop.querySelector(".invisible")).toBeNull();
  });

  it("says a version swapped in whole: only weighing writes a row's words in", async () => {
    render(<StopRowCell example={0} state="complete" density={null} />);
    const list = await dayList();
    const [beach] = await screen.findAllByRole("slider", { name: /^Energy at/ });
    if (!beach) throw new Error("The beach has no slider");

    // A livelier version that still says how it sounds, so the row's texture changes.
    fireEvent.keyDown(beach, { key: "End" });

    const swapped = within(list).getByRole("button", { name: /^Paseo de Gomiz/ });
    expect(swapped).toHaveTextContent(
      "Running shoes on the paving, waves on the rocks below, gulls.",
    );
    expect(swapped.querySelector(".invisible")).toBeNull();
  });

  it("shows no waiting line while the stream is not silent", async () => {
    render(<StopRowCell example={1} state="written" density={null} />);

    await dayList();
    expect(document.querySelector("[data-waiting]")).toBeNull();
  });

  it.each([
    ["standard", "lunch · Puerto"],
    ["folded", "lunch"],
  ] as const)(
    "says a place to eat around by its meal, and %s, its quarter",
    async (density, words) => {
      const example = STOP_ROW_EXAMPLES.findIndex(
        ({ label }) => label === "a lunch named by its food and where",
      );
      render(<StopRowCell example={example} state="complete" density={density} />);

      const list = await dayList();
      const lunch = within(list).getByRole("button", { name: /^Paella on the marina/ });
      // Its name says what is eaten there, so the row says when, and where, as any other
      // place says its kind and quarter; folded, its name and meal, as a folded row does.
      // Under them, how full and how loud it is.
      const feel = feelOf("a lunch named by its food and where", "Paella on the marina");
      expect(lunch).toHaveTextContent(new RegExp(`^Paella on the marina${words}${feel}$`));
    },
  );

  it("says a place to eat around by its meal and quarter at the density its energy gives", async () => {
    const example = STOP_ROW_EXAMPLES.findIndex(
      ({ label }) => label === "a lunch named by its food and where",
    );
    render(<StopRowCell example={example} state="complete" density={null} />);

    const list = await dayList();
    const lunch = within(list).getByRole("button", { name: /^Paella on the marina/ });
    expect(lunch).toHaveTextContent(/^Paella on the marinalunch · Puerto/);
  });

  it.each([
    ["a lunch whose name says its quarter", "Curry in lower Mouraria", "lunch"],
    ["a place whose name says its quarter", "Mosteiro de São Vicente de Fora", "sacred"],
    ["a café", "Matcha and sweets on Shijo", "café · Gion"],
    ["a late supper past midnight", "Bifanas on Rua do Norte", "late supper · Bairro Alto"],
  ])("says %s after its name", async (label, name, words) => {
    const example = STOP_ROW_EXAMPLES.findIndex((each) => each.label === label);
    render(<StopRowCell example={example} state="complete" density="standard" />);

    const list = await dayList();
    const row = within(list).getByRole("button", { name: new RegExp(`^${name}`) });
    // A quarter its name says is not said again, whatever its kind; under it, how full and
    // how loud it is.
    expect(row).toHaveTextContent(new RegExp(`^${name}${words}${feelOf(label, name)}$`));
  });

  it("holds every row at the density it is given", async () => {
    render(<StopRowCell example={0} state="complete" density="folded" />);

    await dayList();
    expect(screen.queryByText("Small waves, a beach rake, gulls.")).not.toBeInTheDocument();
  });
});

describe("cellFrameOf", () => {
  /** The page's frame of Alicante, 9:00 to 23:00, and a cell's two rows in the morning. */
  const PAGE = { start: hours(9), end: hours(23) };
  const CELL = { start: hours(10), end: hours(13) };
  /** A phone's day height, `h-day`. */
  const PHONE_DAY = 540;

  /** How tall the hours between two minutes stand on a frame with no rows. */
  const heightOf = (basisHeight: number, frame: { start: number; end: number }) => {
    const { scale } = rowScale(CELL_WIDTH, basisHeight, frame.start, frame.end, []);
    return (from: number, to: number) => scale.yOf(to) - scale.yOf(from);
  };

  it("runs from the cell's first hour to the page's last, at the page's pace", () => {
    const { bounds, basisHeight } = cellFrameOf(CELL, PAGE, PHONE_DAY);

    expect(bounds).toEqual({ start: CELL.start, end: PAGE.end });
    expect(heightOf(basisHeight, bounds)(hours(12), hours(13))).toBeCloseTo(
      heightOf(PHONE_DAY, PAGE)(hours(12), hours(13)),
    );
  });

  it("ends a whole day's frame where the page does, on the hour after its last visit", () => {
    const whole = [{ startTime: "11:00", durationMinutes: 90 }];
    const { bounds, basisHeight } = cellFrameOf(PAGE, PAGE, PHONE_DAY, whole);

    // 12:30 rounds up to 13:00, but a frame that short would stand under the chart's least.
    expect(bounds.start).toBe(PAGE.start);
    expect(bounds.end).toBeGreaterThan(hours(13));
    expect(bounds.end).toBeLessThan(PAGE.end);
    expect(basisHeight).toBeGreaterThanOrEqual(CHART.minHeight);
    expect(heightOf(basisHeight, bounds)(hours(12), hours(13))).toBeCloseTo(
      heightOf(PHONE_DAY, PAGE)(hours(12), hours(13)),
    );
  });

  it("keeps the page's least height when the day's is not measured", () => {
    const { bounds, basisHeight } = cellFrameOf(CELL, PAGE, 0);

    expect(heightOf(basisHeight, bounds)(hours(12), hours(13))).toBeCloseTo(
      heightOf(CHART.minHeight, PAGE)(hours(12), hours(13)),
    );
  });
});
