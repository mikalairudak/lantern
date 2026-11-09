import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { revealedOf } from "@/features/itinerary/revealed";
import { firstAt, partialAt } from "@/features/itinerary/stream-frames";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { draftDayOf, openableStopsOf, type StopDraft } from "./day-draft";
import { StopRowCell } from "./stop-row-cell";
import {
  STOP_ROW_EXAMPLES,
  draftAt,
  itineraryOf,
  windowAround,
  type StopRowStill,
} from "./stop-row-examples";
import type { StopArrival } from "./use-arrivals";

const CELL_WIDTH = 390;
/** The calm beach: it opens, so weighed it says its neighbourhood and its texture. */
const BEACH = "stop-0";
const BEACH_NAME = /^Playa del Postiguet/;
/** A pen, its bead's slide and Motion's frames, well within this. */
const SPRINGS_TIMEOUT = { timeout: 3000 };

/**
 * Which arrivals the test holds back, their energy written but their bead not filled yet:
 * a stop in `streamed` landed before its energy was written, the frames between the energy
 * token and the bead; a stop in `landed` landed with its energy already written.
 */
const held = vi.hoisted(() => ({
  streamed: new Set<string>(),
  landed: new Set<string>(),
  /** A frame of the stream the cell shows in place of its state's, when a test sets one. */
  still: null as Promise<StopRowStill> | null,
}));

vi.mock("./stop-row-examples", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stop-row-examples")>();
  return {
    ...actual,
    stillOf: (...args: Parameters<typeof actual.stillOf>) => held.still ?? actual.stillOf(...args),
  };
});

vi.mock("./use-arrivals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./use-arrivals")>();
  return {
    ...actual,
    useArrivals: (...args: Parameters<typeof actual.useArrivals>) => {
      const arrivals = actual.useArrivals(...args);
      const of = (stop: StopDraft): StopArrival => {
        const arrival = arrivals.of(stop);
        if (held.streamed.has(stop.id)) {
          return { ...arrival, isReady: false, hasLandedWeighed: false };
        }
        if (held.landed.has(stop.id)) return { ...arrival, isReady: false, hasLandedWeighed: true };
        return arrival;
      };
      return { ...arrivals, of };
    },
  };
});

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
  held.streamed.clear();
  held.landed.clear();
  held.still = null;
});

async function dayList(): Promise<HTMLElement> {
  return screen.findByRole("list", { name: "The day" });
}

/** The day once its rows have taken their places and it can be used. */
async function placedDay(): Promise<HTMLElement> {
  const list = await dayList();
  await waitFor(() => expect(list).toHaveAttribute("aria-busy", "false"), SPRINGS_TIMEOUT);
  return list;
}

function beachWords(list: HTMLElement): HTMLElement {
  return within(list).getByRole("button", { name: BEACH_NAME });
}

/**
 * Where each row's words stand this frame, as Motion draws them: a row's words stand its
 * room above its wire, and a row's wire as far below the one before as their words need.
 */
function rowTransforms(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.style.transform);
}

describe("a row between its energy and its bead", () => {
  /** A letter's width and a line's height in the stand-in layout below. */
  const LETTER_PX = 6;
  const LINE_PX = 20;
  const offsets = {
    width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
    height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
  };
  /**
   * A stand-in for the browser's layout, which jsdom lacks: words run a letter's width at a
   * time and wrap at their element's `max-width`, so a row says how much room its words
   * take as laid out, and more words, or a narrower column, take more lines.
   */
  beforeAll(() => {
    const columnOf = (element: HTMLElement) => Number.parseFloat(element.style.maxWidth);
    const naturalOf = (element: HTMLElement) => (element.textContent ?? "").length * LETTER_PX;
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        const column = columnOf(this);
        return Number.isNaN(column) ? naturalOf(this) : Math.min(naturalOf(this), column);
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        const column = columnOf(this);
        if (Number.isNaN(column)) return LINE_PX;
        return column > 0 ? Math.ceil(naturalOf(this) / column) * LINE_PX : 0;
      },
    });
  });
  afterAll(() => {
    if (offsets.width) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsets.width);
    if (offsets.height)
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsets.height);
  });

  /** How tall the beach's words stand as laid out beside their bead. */
  const wordsHeightOf = (list: HTMLElement) => beachWords(list).parentElement?.offsetHeight ?? 0;
  /** Where the beach's words start across the row, as Motion draws them. */
  const wordsXOf = (list: HTMLElement) =>
    beachWords(list).parentElement?.parentElement?.style.transform ?? "";

  it("holds the room of its resting layout while its words wait unseen", async () => {
    const weighed = render(<StopRowCell example={0} state="complete" density={null} />);
    const restingList = await placedDay();
    const atRest = rowTransforms(restingList);
    const restingHeight = wordsHeightOf(restingList);
    weighed.unmount();
    held.streamed.add(BEACH);

    render(<StopRowCell example={0} state="complete" density={null} />);
    const list = await placedDay();

    // Until its bead is weighed the row says only when, its words unseen (`docs/decisions.md`, "A
    // row's words go where its bead comes to rest, and rows ease rather than jump"): laid out
    // beside the hollow bead, a name could take a line more or less as it was weighed. Unseen, they
    // are still its name and kind, with no room yet for the neighbourhood and texture its energy
    // will add, so they are shorter than they will rest.
    expect(beachWords(list).parentElement).toHaveClass("invisible");
    expect(beachWords(list)).toHaveTextContent(/^Playa del Postiguetviewpoint$/);
    expect(wordsHeightOf(list)).toBeLessThan(restingHeight);
    // The room is already the one it rests in, so neither its wire nor the row under it
    // moves again when the bead fills.
    expect(atRest.every((transform) => transform.startsWith("translateY"))).toBe(true);
    expect(rowTransforms(list)).toEqual(atRest);
  });

  it("stands as it will rest from its first frame when it lands with its energy", async () => {
    const weighed = render(<StopRowCell example={0} state="complete" density={null} />);
    const restingList = await placedDay();
    const atRest = rowTransforms(restingList);
    const restingHeight = wordsHeightOf(restingList);
    const restingX = wordsXOf(restingList);
    weighed.unmount();
    held.landed.add(BEACH);

    const view = render(<StopRowCell example={0} state="complete" density={null} />);
    const list = await dayList();
    await waitFor(() => expect(rowTransforms(list)).toEqual(atRest), SPRINGS_TIMEOUT);

    // Its words already stand in their resting column, room held for all they will say;
    // only the pen waits for the bead, so the day says it is still busy.
    expect(wordsHeightOf(list)).toBe(restingHeight);
    expect(wordsXOf(list)).toBe(restingX);
    expect(beachWords(list)).toHaveTextContent("Small waves, a beach rake, gulls.");
    expect(list).toHaveAttribute("aria-busy", "true");

    // The bead fills: the pen writes in, and nothing of the row moves.
    held.landed.clear();
    view.rerender(<StopRowCell example={0} state="complete" density={null} />);
    await waitFor(() => expect(list).toHaveAttribute("aria-busy", "false"), SPRINGS_TIMEOUT);
    expect(wordsHeightOf(list)).toBe(restingHeight);
    expect(wordsXOf(list)).toBe(restingX);
    expect(rowTransforms(list)).toEqual(atRest);
  });
});

describe("the day's list", () => {
  it("stays busy until the last pen has written the words a bead added", async () => {
    held.streamed.add(BEACH);
    const view = render(<StopRowCell example={0} state="complete" density={null} />);
    const list = await placedDay();
    // The row's button, held from before the pen starts: as it writes the name in, the
    // button is named only by what is written so far.
    const words = beachWords(list);

    // The bead fills: the words come where they rest, and the pen starts writing the name,
    // the neighbourhood and the texture, the room of what is still to come held unseen.
    held.streamed.clear();
    view.rerender(<StopRowCell example={0} state="complete" density={null} />);

    expect(words.parentElement).not.toHaveClass("invisible");
    const unwritten = [...words.querySelectorAll(".invisible")].map((part) => part.textContent);
    expect(unwritten.join("")).toContain("Postiguet");
    expect(list).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(list).toHaveAttribute("aria-busy", "false"), SPRINGS_TIMEOUT);
    // By then everything the row says is written.
    expect(words.querySelector(".invisible")).toBeNull();
    expect(beachWords(list)).toHaveTextContent("Small waves, a beach rake, gulls.");
  });

  it("writes a weighed row's name before it says what kind of place it is and where", async () => {
    held.streamed.add(BEACH);
    const view = render(<StopRowCell example={0} state="complete" density={null} />);
    const list = await placedDay();
    const words = beachWords(list);
    const seen = () => {
      const walker = document.createTreeWalker(words, NodeFilter.SHOW_TEXT);
      let text = "";
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.parentElement?.closest(".invisible")) text += node.textContent ?? "";
      }
      return text;
    };

    held.streamed.clear();
    view.rerender(<StopRowCell example={0} state="complete" density={null} />);

    // The pen sets off on the name; its kind and its quarter wait unseen in their room.
    expect(seen()).not.toMatch(/viewpoint|Postiguet/);
    await waitFor(() => expect(seen()).toMatch(/^Playa del Postiguet.*viewpoint/), SPRINGS_TIMEOUT);
  });
});

describe("a row just weighed, as the matrix stills it", () => {
  it("shows its name's first letter, what kind of place it is waiting unseen", async () => {
    render(<StopRowCell example={0} state="weighing" density={null} />);
    const list = await dayList();
    const words = await within(list).findByRole("button", { name: /^P/ });

    // The pen stands on the name's first letter; the rest of the row holds its room.
    await waitFor(() => expect(words.closest(".invisible")).toBeNull(), SPRINGS_TIMEOUT);
    expect(words).toHaveTextContent(/Playa del Postiguet/);
    const unseen = [...words.querySelectorAll(".invisible")].map((part) => part.textContent);
    expect(unseen.join("")).toContain("viewpoint");
  });
});

describe("a row being written", () => {
  /** An empty line, as the unseen copy holds it open. */
  const EMPTY_LINE = "\u00a0";
  /**
   * The last thing each row's unseen copy sets as it will rest: the room the row holds is
   * measured from these copies, beside the day.
   */
  function lastOfEachCopy(list: HTMLElement): (string | null | undefined)[] {
    const copies = list.parentElement?.querySelector(":scope > div[aria-hidden]")?.children;
    return [...(copies ?? [])]
      .filter((copy) => copy.tagName === "DIV")
      .map((copy) => copy.firstElementChild?.lastElementChild?.textContent);
  }

  it("holds a line open under its words until its energy is written", async () => {
    const writing = render(<StopRowCell example={0} state="naming" density={null} />);
    const list = await dayList();
    await waitFor(() => expect(lastOfEachCopy(list)).toContain(EMPTY_LINE));
    writing.unmount();

    render(<StopRowCell example={0} state="complete" density={null} />);
    expect(lastOfEachCopy(await placedDay())).not.toContain(EMPTY_LINE);
  });
});

describe("a quarter being written", () => {
  const SUBJECT = "a place whose name says its quarter";
  /** Lisbon's monastery, "Mosteiro de São Vicente de Fora", in São Vicente. */
  const STOP = "stop-1";
  const QUARTER_SO_FAR = "São V";

  it("is held back alike by the row and the copies that measure it", async () => {
    const example = STOP_ROW_EXAMPLES.findIndex(({ label }) => label === SUBJECT);
    const { fixture } = STOP_ROW_EXAMPLES[example] ?? {};
    if (!fixture) throw new Error(`No example "${SUBJECT}"`);
    const text = dayText(fixture.day);
    const quarterOf = (stops: readonly StopDraft[]) =>
      stops.find((stop) => stop.id === STOP)?.primary.neighborhood ?? "";
    // "São V" could still become the name's words, and read as written whole it is not them:
    // a copy that read it so would set down a quarter the row holds back.
    const at = await firstAt(
      text,
      (revealed) => quarterOf(draftDayOf(revealed).stops).length >= QUARTER_SO_FAR.length,
    );
    const draft = await draftAt(text, at);
    expect(quarterOf(draft.stops)).toBe(QUARTER_SO_FAR);
    const window = windowAround(draft, 1);
    held.still = Promise.resolve({
      ...window,
      at,
      itinerary: itineraryOf(fixture),
      frame: { kind: "own" },
    });

    render(<StopRowCell example={example} state="naming" density="standard" />);

    const list = await dayList();
    const monastery = within(list).getByRole("button", { name: /^Mosteiro de São Vicente/ });
    // The monastery's own copies, beside the day: its words on one line, and in their column.
    const copiesOf = () =>
      [...(list.parentElement?.querySelector(":scope > div[aria-hidden]")?.children ?? [])]
        .map((copy) => copy.textContent ?? "")
        .filter((words) => words.startsWith("Mosteiro"));
    await waitFor(() => expect(copiesOf()).toHaveLength(2));
    expect(monastery).toHaveTextContent(/^Mosteiro de São Vicente de Forasacred$/);
    for (const words of copiesOf())
      expect(words.trim()).toBe("Mosteiro de São Vicente de Forasacred");
  });
});

describe("a stop's name", () => {
  async function beachName() {
    render(<StopRowCell example={0} state="complete" density={null} />);
    const beach = within(await dayList()).getByRole("button", { name: BEACH_NAME });
    await waitFor(() => expect(beach).toBeEnabled());
    return beach;
  }

  it("holds back the click a phone sends after a tap on a bead, the name glided under the finger", async () => {
    const beach = await beachName();
    const bead = document.querySelector("circle") ?? document.body;

    fireEvent.pointerDown(bead);
    fireEvent.pointerUp(bead);
    fireEvent.click(beach, { detail: 1 });

    expect(beach).toHaveAttribute("aria-expanded", "false");
  });

  it("opens for a press that began on it", async () => {
    const beach = await beachName();

    fireEvent.pointerDown(beach);
    fireEvent.pointerUp(beach);
    fireEvent.click(beach, { detail: 1 });

    expect(beach).toHaveAttribute("aria-expanded", "true");
  });

  it("opens for a click with no press before it, as an assistive technology sends", async () => {
    const beach = await beachName();

    fireEvent.click(beach, { detail: 1 });

    expect(beach).toHaveAttribute("aria-expanded", "true");
  });

  it("opens for a key's click after a press elsewhere that ended in no click", async () => {
    const beach = await beachName();

    fireEvent.pointerDown(document.body);
    fireEvent.click(beach, { detail: 0 });

    expect(beach).toHaveAttribute("aria-expanded", "true");
  });

  it("forgets a press elsewhere once a click has ended it, or a cancel, or a second", async () => {
    const beach = await beachName();

    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body, { detail: 1 });
    fireEvent.click(beach, { detail: 1 });
    expect(beach).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(document.body);
    fireEvent.pointerCancel(document.body);
    fireEvent.click(beach, { detail: 1 });
    expect(beach).toHaveAttribute("aria-expanded", "false");

    const now = vi.spyOn(performance, "now");
    fireEvent.pointerDown(document.body);
    now.mockReturnValue(0);
    fireEvent.pointerUp(document.body);
    now.mockReturnValue(1500);
    fireEvent.click(beach, { detail: 1 });
    now.mockRestore();
    expect(beach).toHaveAttribute("aria-expanded", "true");
  });
});

describe("a stop while the day is written", () => {
  const LIVELY = STOP_ROW_EXAMPLES.findIndex(({ label }) => label === "a lively place");

  it("opens once it is whole and its row has come to rest", async () => {
    render(<StopRowCell example={0} state="open-written" density={null} />);

    // No version has arrived: the day cannot be dragged, but the beach can be read.
    expect(await screen.findByRole("region", { name: /^About Playa del Postiguet/ })).toBeVisible();
    const beach = within(await dayList()).getByRole("button", { name: BEACH_NAME });
    expect(beach).toBeEnabled();
    expect(beach).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the day's last stop once a version has begun", async () => {
    const supper = STOP_ROW_EXAMPLES.findIndex(
      ({ label }) => label === "a late supper past midnight",
    );
    render(<StopRowCell example={supper} state="open-written" density={null} />);

    expect(await screen.findByRole("region", { name: /^About Bifanas/ })).toBeVisible();
  });

  it("keeps the last stop of a day with no versions shut until the stream has ended", async () => {
    const minimal = STOP_ROW_EXAMPLES.findIndex(({ label }) => label === "one version only");
    render(<StopRowCell example={minimal} state="open-written" density={null} />);

    const [only] = within(await dayList()).getAllByRole("button");
    expect(only).toBeDisabled();
    expect(only).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: /^About / })).toBeNull();
  });

  it("stays shut while its bead waits", async () => {
    held.streamed.add(BEACH);
    render(<StopRowCell example={0} state="written" density={null} />);

    const beach = within(await dayList()).getByRole("button", { name: BEACH_NAME });
    expect(beach).toBeDisabled();
  });

  it("stays shut while its last line is written, as the whole stop above it opens", async () => {
    const { fixture, stop } = STOP_ROW_EXAMPLES[LIVELY] ?? {};
    if (!fixture || stop === undefined) throw new Error('No example "a lively place"');
    const text = dayText(fixture.day);
    const id = `stop-${stop}`;
    const noteOf = (stops: readonly StopDraft[]) =>
      stops.find((each) => each.id === id)?.primary.light?.note ?? "";
    // Its row is all written and its bead can fill; only its light's note, the last line its
    // sheet says, is still on its way.
    const at = await firstAt(text, (revealed) => noteOf(draftDayOf(revealed).stops).length >= 5);
    const revealed = revealedOf(await partialAt(text, at), null);
    const draft = draftDayOf(revealed);
    held.still = Promise.resolve({
      ...windowAround(draft, stop),
      at,
      itinerary: itineraryOf(fixture),
      frame: { kind: "own" },
      openableStops: openableStopsOf(revealed.day, draft),
    });

    render(<StopRowCell example={LIVELY} state="naming" density={null} />);

    const list = await dayList();
    await waitFor(() => expect(within(list).getAllByRole("button")[0]).toBeEnabled());
    const [above, writing] = within(list).getAllByRole("button");
    expect(above).toBeEnabled();
    expect(writing).toBeDisabled();
  });
});
