import { render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FAILED_NOTE, READING_NOTE } from "@/features/itinerary/use-still";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { LISBON_DAY } from "@/lib/fixtures/curated/lisbon";
import type { DayOutcome } from "@/lib/stream/outcome";
import { noticeOf } from "./stream-ending";
import {
  BEING_WRITTEN,
  LINK_EXPIRED,
  OPENS_HERE,
  PROPOSED_BESIDE,
  STILL_WRITING,
  THE_DAY_BEFORE,
  THE_PROPOSAL,
  YOUR_DAY_WHILE_WRITTEN,
} from "./not-yet";
import { ONE_CHANGE_AT_A_TIME } from "./day-stage-header";
import { requestSentenceOf } from "./sentence";
import { DayStageHeaderCell } from "./day-stage-header-cell";
import { HEADER_DAYS, HEADER_MOMENTS, type HeaderMoment } from "./day-stage-header-examples";
import { DAY_STAGE_HEADER_MATRIX } from "./day-stage-header-matrix";

/** jsdom lays nothing out; the header's gliding boxes only need to be told nothing moved. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/**
 * The still every cell reads while a test sets one, as the examples' cache gives one promise
 * per cell; null, they read as they do.
 */
const failure = vi.hoisted(() => ({ still: null as Promise<never> | null }));

vi.mock("./day-stage-header-examples", async (importOriginal) => {
  const examples = await importOriginal<typeof import("./day-stage-header-examples")>();
  return {
    ...examples,
    stillOf: (...args: Parameters<typeof examples.stillOf>) =>
      failure.still ?? examples.stillOf(...args),
  };
});

beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  failure.still = null;
});

const KANAZAWA = 0;
const LISBON = 1;
const HONG_KONG = 2;
const PORTLAND = 3;
const TROMSO = 4;

/** What an element shows: its letters, but not those holding room unseen in their place. */
function seenTextOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(".invisible")) text += node.textContent ?? "";
  }
  return text.replace(/\s+/gu, " ").trim();
}

function momentAt(key: HeaderMoment): number {
  return HEADER_MOMENTS.findIndex((moment) => moment.key === key);
}

/** One cell of the matrix, once it has read its frame of the day. */
async function renderCell(key: HeaderMoment, day: number) {
  const view = render(<>{DAY_STAGE_HEADER_MATRIX.renderCell([momentAt(key), day], "phone")}</>);
  await waitFor(() => expect(screen.queryByText(READING_NOTE)).not.toBeInTheDocument());
  return view;
}

function headline(): HTMLElement {
  return screen.getByRole("heading", { level: 1 });
}

/** The live line about the day: the one not inside an unseen reserve. */
function liveDek(dek: string): HTMLElement | undefined {
  const start = dek.slice(0, 4);
  return screen
    .queryAllByText(
      (_, element) => element?.tagName === "P" && element.textContent.startsWith(start),
    )
    .find((line) => line.closest("[aria-hidden]") === null);
}

/** The product's words for each ending, as `docs/decisions.md` records them. */
const ENDING_WORDS: Readonly<Record<string, RegExp>> = {
  unfinished: /^Lantern couldn't finish this day\. Write it again, or open one it has written:$/,
  dropped:
    /^The connection dropped before Lantern finished this day\. Write it again, or open one it has written:$/,
  refused: /^Lantern can't plan this day\. Open one it has written:$/,
  busy: /^Lantern couldn't write this day just now\. Write it again$/,
  "not-yet": /^Lantern isn't writing new days right now\. These are written:$/,
  resting: /^Lantern has written all the days it can for now\. These are written:$/,
};

/** Each ending moment and what the stream reader reports for it. */
const ENDINGS: readonly { key: HeaderMoment; outcome: DayOutcome }[] = [
  { key: "cut", outcome: { kind: "cut", itinerary: null } },
  { key: "disconnected", outcome: { kind: "disconnected", itinerary: null } },
  { key: "refused", outcome: { kind: "refused" } },
  { key: "unavailable", outcome: { kind: "unavailable" } },
  { key: "limited", outcome: { kind: "limited" } },
];

describe("the day stage header's matrix", () => {
  it("sets every moment on every day, or says why the day never reaches it", async () => {
    const notes: string[] = [];
    for (const [moment, { key }] of HEADER_MOMENTS.entries()) {
      for (const [day, { label }] of HEADER_DAYS.entries()) {
        const view = await renderCell(key, day);
        // The first frame's copy is unheard, its headline hidden from the reader too.
        const heading = screen.queryByRole("heading", { level: 1, hidden: true });
        if (heading === null) notes.push(`${HEADER_MOMENTS[moment]?.label} · ${label}`);
        // A cell never takes the focus, or the matrix would scroll to it.
        expect(document.activeElement).toBe(document.body);
        view.unmount();
      }
    }

    expect(HEADER_MOMENTS).toHaveLength(30);
    expect(HEADER_DAYS).toHaveLength(6);
    // Portland has no written day, so only its first moment and its endings without a day
    // are reached, and no re-plan, which a written day asks; Tromsø and Hong Kong have no
    // other versions, so no drag can make them livelier, and no cut can fall inside their
    // swaps; Hong Kong's every word is the visitor's, so Lantern writes none.
    expect(notes.filter((note) => note.includes("Portland"))).toHaveLength(20);
    expect(notes.filter((note) => note.includes("Tromsø"))).toEqual([
      "written, after one stop is dragged livelier · Tromsø, a sun that never rises",
      "written, after every stop is dragged livelier · Tromsø, a sun that never rises",
      "cut or dropped in the swaps, the day kept (after launch) · Tromsø, a sun that never rises",
    ]);
    expect(
      notes.filter((note) => note.includes("Hong Kong")).map((note) => note.split(" · ")[0]),
    ).toEqual([
      "the start screen's turn: the words after Lantern's first held unseen",
      "Lantern's words being written",
      "written, after one stop is dragged livelier",
      "written, after every stop is dragged livelier",
      "cut or dropped in the swaps, the day kept (after launch)",
    ]);
    // Elche's day is production's record, kept whole without the stream that wrote it.
    expect(
      notes.filter((note) => note.includes("Elche")).map((note) => note.split(" · ")[0]),
    ).toEqual([
      "the start screen's turn: the words after Lantern's first held unseen",
      "Lantern's words being written",
      "the line about the day, mid-word",
      "cut or dropped in the swaps, the day kept (after launch)",
    ]);
    expect(notes).toHaveLength(20 + 3 + 5 + 4);
  });

  it("says why a day never reaches a moment", async () => {
    await renderCell("written", PORTLAND);
    expect(
      screen.getByText("No day is written for Portland, so it never reaches this moment."),
    ).toBeInTheDocument();
  });

  it("starts with the visitor's words alone, each word Lantern assumed dotted", async () => {
    await renderCell("asked", KANAZAWA);
    expect(headline()).toHaveTextContent(/^A calm Saturday in Kanazawa, early start$/);
    const kanazawa = within(headline());
    expect(kanazawa.getByRole("button", { name: "calm" })).not.toHaveClass("decoration-dotted");
    expect(kanazawa.getByRole("button", { name: "early start" })).not.toHaveClass(
      "decoration-dotted",
    );

    await renderCell("asked", PORTLAND);
    const portland = within(screen.getAllByRole("heading", { level: 1 })[1]!);
    expect(portland.getByRole("button", { name: "Portland" })).toHaveClass("decoration-dotted");
    // "Out late with friends" points to a lively day without naming one.
    expect(portland.getByRole("button", { name: "lively" })).toHaveClass("decoration-dotted");
  });

  it("says so when a day's frames fail to read, rather than reading for good", async () => {
    failure.still = Promise.reject(new Error("A header day does not normalize"));
    // Read by the cell; marked handled so the runner does not report it before then.
    failure.still.catch(() => undefined);
    await renderCell("written", KANAZAWA);

    expect(screen.getByText(`${FAILED_NOTE} A header day does not normalize`)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("refuses a day the matrix does not have", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<DayStageHeaderCell day={HEADER_DAYS.length} moment="asked" />)).toThrow(
      `The day stage header has no day ${HEADER_DAYS.length}`,
    );
    vi.mocked(console.error).mockRestore();
  });

  it("dots nothing and keys nothing when every word is the visitor's", async () => {
    await renderCell("written", HONG_KONG);

    expect(headline()).toHaveTextContent(
      /^A quiet Saturday in Hong Kong, on foot, slow morning, early dinner, home by eleven, alone$/,
    );
    expect(screen.queryByText("assumed")).not.toBeInTheDocument();
  });

  it("keeps the day written, with its hint and no notice, when a cut falls inside its swaps", async () => {
    await renderCell("kept", KANAZAWA);

    expect(headline()).toHaveTextContent(
      /^A calm Saturday in Kanazawa, on foot, early start, early dinner, home by eleven, with anyone$/,
    );
    expect(liveDek(KANAZAWA_START_DAY.day.dek)).toHaveTextContent(KANAZAWA_START_DAY.day.dek);
    expect(screen.getAllByText("click a word to change it")[0]).toBeInTheDocument();
    expect(screen.queryByText(/^Lantern couldn't/)).not.toBeInTheDocument();
  });

  it("writes Lantern's words as the stream finishes each, and holds back the one still streaming", async () => {
    await renderCell("words", KANAZAWA);

    expect(headline()).toHaveTextContent(
      /^A calm Saturday in Kanazawa, on foot, early start, early dinner$/,
    );
  });

  it("stops the line about the day mid-word, its newest letters still drying", async () => {
    await renderCell("dek", KANAZAWA);

    const written = KANAZAWA_START_DAY.day.dek;
    const line = liveDek(written);
    const text = line?.textContent ?? "";
    expect(text.length).toBeGreaterThan(written.length / 2);
    expect(written.startsWith(text)).toBe(true);
    expect(text.at(-1)).toMatch(/\p{L}/u);
    expect(written[text.length]).toMatch(/\p{L}/u);
    expect(line?.querySelector(".text-muted")).not.toBeNull();
  });

  it("ends a written day with the hint, the sun's times and the whole line about the day", async () => {
    await renderCell("written", LISBON);

    expect(liveDek(LISBON_DAY.day.dek)).toHaveTextContent(LISBON_DAY.day.dek);
    expect(screen.getAllByText("sunrise 07:18")[0]).toBeInTheDocument();
    expect(screen.getAllByText("click a word to change it")[0]).toBeInTheDocument();
  });

  it("says no sun on a day it never rises", async () => {
    await renderCell("written", TROMSO);

    expect(screen.queryByText(/sunrise/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Sat 12 Dec/)[0]).toBeInTheDocument();
  });

  it("says the day's own clause once one stop, then every stop, is dragged livelier", async () => {
    await renderCell("one-livelier", KANAZAWA);
    expect(headline()).toHaveTextContent("A calm Saturday, livelier in the afternoon, in Kanazawa");

    await renderCell("all-livelier", LISBON);
    expect(screen.getAllByRole("heading", { level: 1 })[1]).toHaveTextContent(
      "A lively Saturday, livelier in places, in Lisbon",
    );
  });

  it("says what a changed word would have re-planned, for the word that says the most", async () => {
    await renderCell("changed", KANAZAWA);

    expect(
      screen.getByText(
        "Lantern isn't re-planning days right now, so the morning and midday stay as written",
      ),
    ).toBeInTheDocument();
  });

  it("says back the visitor's phrases Lantern cannot plan around", async () => {
    await renderCell("unplaced", LISBON);

    expect(
      screen.getAllByText("Lantern can't plan around “with my dog” and “vegetarian”.")[0],
    ).toBeInTheDocument();
  });

  it.each(ENDINGS)("ends the day in the product's words: $key", async ({ key, outcome }) => {
    for (const [day, { request }] of HEADER_DAYS.entries()) {
      const view = await renderCell(key, day);
      const notice = noticeOf(outcome, request);

      expect(notice).not.toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent(ENDING_WORDS[notice?.kind ?? ""]!);
      // Only the visitor's words stand in the sentence: the outcome, not the partial, says
      // what shows after an ending without a day.
      expect(headline()).toHaveTextContent(new RegExp(`^${requestSentenceOf(request)}$`));
      const offered = screen.queryByRole("list");
      const sentences = offered
        ? within(offered)
            .getAllByRole("button")
            .map((button) => button.textContent)
        : [];
      expect(sentences).toEqual(notice?.written.map(requestSentenceOf));
      view.unmount();
    }
  });

  it("says at a day's own address that it is still being written, or that its link expired", async () => {
    const lines = [
      ["kept-writing", `${STILL_WRITING} ${OPENS_HERE}`],
      ["kept-expired", `${LINK_EXPIRED} Write it again, or open one it has written:`],
    ] as const;
    for (const [moment, line] of lines) {
      const view = await renderCell(moment, KANAZAWA);
      expect(screen.getByRole("status")).toHaveTextContent(line);
      expect(headline()).toHaveTextContent(/^A calm Saturday in Kanazawa, early start$/);
      view.unmount();
    }
  });

  it("sets a fork's states: its word's pair, the proposal lit, the others locked, its list taking either version", async () => {
    const writing = await renderCell("replan-writing", KANAZAWA);
    expect(seenTextOf(headline())).toBe(
      "A calm Saturday in Kanazawa, on foot, early start, early dinner or eating late, home by eleven, with anyone",
    );
    // The proposal's answer is blue, and points to its fork; the visitor's word is theirs.
    const pair = within(headline()).getByRole("button", { name: /^eating late, proposed/ });
    expect(pair).toHaveClass("text-swap");
    // The date is muted with the locked words.
    expect(within(headline()).getByText("Saturday")).toHaveClass("text-muted");
    expect(within(headline()).getByRole("button", { name: /^on foot/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    writing.unmount();

    // The longest answer a word offers stands as its pair as any does.
    const longest = await renderCell("replan-writing-longest", KANAZAWA);
    expect(seenTextOf(headline())).toBe(
      "A calm Saturday in Kanazawa, on foot or by public transport, early start, early dinner, home by eleven, with anyone",
    );
    longest.unmount();

    const shortest = await renderCell("replan-writing-shortest", KANAZAWA);
    expect(seenTextOf(headline())).toBe(
      "A calm Saturday in Kanazawa, on foot, early start, early dinner, home by eleven or out late, with anyone",
    );
    shortest.unmount();

    const locked = await renderCell("replan-locked", KANAZAWA);
    expect(screen.getAllByText(ONE_CHANGE_AT_A_TIME).length).toBeGreaterThan(0);
    locked.unmount();

    // Where the facts line has no hint left, the note stands alone at its end.
    const unhinted = await renderCell("replan-locked-unhinted", KANAZAWA);
    expect(screen.getAllByText(ONE_CHANGE_AT_A_TIME).length).toBeGreaterThan(0);
    expect(screen.queryByText("click a word to change it")).not.toBeInTheDocument();
    unhinted.unmount();

    // Drawn open a frame after the cell, as a press opens it.
    const lines = [
      ["replan-writing-list", "early dinner", YOUR_DAY_WHILE_WRITTEN],
      ["replan-writing-list", "eating late", BEING_WRITTEN],
      ["replan-proposed", "eating late", PROPOSED_BESIDE],
      ["replan-taken", "early dinner", THE_DAY_BEFORE],
      ["replan-left", "eating late", THE_PROPOSAL],
    ] as const;
    for (const [moment, answer, line] of lines) {
      const view = await renderCell(moment, KANAZAWA);
      const option = await screen.findByRole("option", { name: answer });
      expect(option, moment).toHaveAccessibleDescription(line);
      // A cell never takes the focus, or the matrix would scroll to it.
      expect(document.activeElement).toBe(document.body);
      view.unmount();
    }
  });

  it("says busy over a written day and not yet over any other when nothing came", async () => {
    const kinds = HEADER_DAYS.map(
      ({ request }) => noticeOf({ kind: "unavailable" }, request)?.kind,
    );

    // Kanazawa's is a written day; Lisbon's, written by hand, is no day of the site's.
    expect(kinds).toEqual(["busy", "not-yet", "not-yet", "not-yet", "not-yet", "not-yet"]);
  });

  it("says which moments a visitor reaches only with live generation on", () => {
    const afterLaunch = HEADER_MOMENTS.filter(({ label }) => label.includes("(after launch)"));

    // With live generation off the route answers every written day whole and any other city with
    // not yet, and a changed word re-plans nothing: only a live model's stream is cut, dropped,
    // refused, busy or at our own limit, and only a live day re-plans.
    expect(afterLaunch.map(({ key }) => key)).toEqual([
      "replanning",
      "replan-writing",
      "replan-writing-longest",
      "replan-writing-shortest",
      "replan-writing-list",
      "replan-locked",
      "replan-locked-unhinted",
      "replan-proposed",
      "replan-taken",
      "replan-left",
      "kept",
      "cut",
      "disconnected",
      "refused",
      "unavailable",
      "limited",
      "kept-writing",
      "kept-expired",
    ]);
    expect(afterLaunch.find(({ key }) => key === "unavailable")?.label).toBe(
      "unavailable: busy over a written day (after launch), not yet over any other",
    );
  });
});
