import { render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FAILED_NOTE, READING_NOTE } from "@/features/itinerary/use-still";
import { SilenceCell } from "./silence-cell";
import { ONE_STOP, SILENCE_DAYS } from "./silence-examples";

const CELL_WIDTH = 390;

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

/**
 * The still every cell reads while a test sets one, as the examples' cache gives one promise
 * per cell; null, they read as they do.
 */
const failure = vi.hoisted(() => ({ still: null as Promise<never> | null }));

vi.mock("./silence-examples", async (importOriginal) => {
  const examples = await importOriginal<typeof import("./silence-examples")>();
  return {
    ...examples,
    silenceOf: (...args: Parameters<typeof examples.silenceOf>) =>
      failure.still ?? examples.silenceOf(...args),
  };
});

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

function dayIndexOf(label: string): number {
  const index = SILENCE_DAYS.findIndex((day) => day.label === label);
  if (index === -1) throw new Error(`No day "${label}"`);
  return index;
}

describe("SilenceCell", () => {
  it("reads its frame of the stream, then stands the waiting line under the last row", async () => {
    render(<SilenceCell day={dayIndexOf("Alicante")} moment="after-stop" />);

    expect(screen.getByText(READING_NOTE)).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "The day" });
    expect(list).toHaveTextContent("Mercado Central");
    // The phrase where the next row will be written, and the pen's tick on the time axis.
    expect(screen.getByText("midday")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-waiting="voice"]')).toHaveLength(2);
  });

  it("waits for the versions after a last stop that reaches the hours asked for", async () => {
    render(<SilenceCell day={dayIndexOf("a night past midnight")} moment="after-last" />);

    expect(await screen.findByText("other versions")).toBeInTheDocument();
  });

  it("says why a day of one stop has no silence after a stop but its last", async () => {
    render(<SilenceCell day={dayIndexOf("one stop")} moment="after-stop" />);

    expect(await screen.findByText(ONE_STOP)).toHaveClass("text-small", "text-muted");
    expect(screen.queryByRole("list", { name: "The day" })).not.toBeInTheDocument();
  });

  it("says so when its frames of the stream fail to read, rather than reading for good", async () => {
    failure.still = Promise.reject(new Error("A fixture day does not normalize"));
    // Read by the cell; marked handled so the runner does not report it before then.
    failure.still.catch(() => undefined);
    render(<SilenceCell day={dayIndexOf("Kyoto")} moment="after-stop" />);

    expect(
      await screen.findByText(`${FAILED_NOTE} A fixture day does not normalize`),
    ).toBeInTheDocument();
    expect(screen.queryByText(READING_NOTE)).not.toBeInTheDocument();
  });

  it("refuses a day the matrix does not have", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<SilenceCell day={SILENCE_DAYS.length} moment="after-stop" />)).toThrow(
      `The silences have no day ${SILENCE_DAYS.length}`,
    );
    vi.mocked(console.error).mockRestore();
  });
});
