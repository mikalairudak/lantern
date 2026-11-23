import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PORTLAND_MAINE, PORTLAND_OREGON } from "@/lib/fixtures/city-readings";
import { LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { INDEX_REQUESTS, PARIS_REQUEST } from "@/lib/days/written/city-days";
import { MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import {
  MAX_INTAKE_TEXT_CHARS,
  type CityReading,
  type IntakeWords,
} from "@/lib/schema/intake.schema";
import {
  NOT_LIVE_NOTE,
  PROMISE,
  StartHeader,
  type StartHeaderProps,
  type StartWait,
} from "./start-header";
import { INDEX_LABEL } from "./start-index";
import { NOTICE_HEARD_MS } from "./notice-status";
import { ASSUMED_NOTE } from "./sentence-word";
import { startOffersOf } from "./start-offers";
import { writtenPool } from "./written-pool";
import type { YourDay } from "./your-days";
import { FORGET_ANSWER, FORGET_ANSWER_WAIT_MS } from "./your-days-ledger";
import { FORGET_YOUR_DAYS } from "./your-days-ledger-words";

/** "Forget" takes a press only once a double press on "Forget these days" is over. */
const waitOutADoublePress = () => new Promise((done) => setTimeout(done, FORGET_ANSWER_WAIT_MS));

/** The written days as the index offers them. */
const STARTS = startOffersOf(writtenPool());

/**
 * The start's own status in the form, or over it: the theme's button in the masthead says its
 * look in one too.
 */
function startStatusWhere(isInForm: boolean): HTMLElement {
  const [status, ...others] = screen
    .getAllByRole("status")
    .filter((status) => !status.hasAttribute("data-theme-status"))
    .filter((status) => (status.closest("form") !== null) === isInForm);
  if (!status || others.length > 0) throw new Error("Not one status of the start's own there");
  return status;
}

/** An element's text, but not that of the nodes under `left` (a selector), in order. */
function textOutside(element: Element, left: string): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(left)) text += node.textContent ?? "";
  }
  return text;
}

/** The line under the field, in a status of its own. */
const startStatus = () => startStatusWhere(true);

/** What an answer to the question says to a screen reader, from the status over the form. */
const answerStatus = () => startStatusWhere(false);

const NO_WORDS: IntakeWords = {
  date: null,
  energy: "balanced",
  energySource: "assumed",
  travel: null,
  start: null,
  dinner: null,
  end: null,
  company: null,
};

type HeldStartProps = Omit<StartHeaderProps, "text" | "onTextChange" | "wait"> & {
  /** The wait as the page holds it; left out, the one a press set (`waitAtPlan`), or none. */
  wait?: StartWait | null;
  /** The wait the page starts at a press, as `Day` does while it reads the text. */
  waitAtPlan?: StartWait;
};

/** The header with its text held as the day holds it, and its wait as the page sets it. */
function HeldStart({ wait, waitAtPlan, onPlan, ...props }: HeldStartProps) {
  const [text, setText] = useState("");
  const [waitPressed, setWaitPressed] = useState<StartWait | null>(null);
  const plan = (asked: string) => {
    if (waitAtPlan) setWaitPressed(waitAtPlan);
    onPlan(asked);
  };
  return (
    <StartHeader
      {...props}
      text={text}
      onTextChange={setText}
      onPlan={plan}
      wait={wait === undefined ? waitPressed : wait}
    />
  );
}

function renderStart(props: Partial<HeldStartProps> = {}) {
  const handlers = {
    onPlan: vi.fn(),
    onChooseWritten: vi.fn(),
    onChooseReading: vi.fn(),
  };
  const view = render(
    <HeldStart starts={STARTS} line={null} isLive={false} isCityFocused {...handlers} {...props} />,
  );
  return { ...view, ...handlers };
}

const writtenDays = () => screen.getByRole("list", { name: INDEX_LABEL });

describe("StartHeader", () => {
  it("says what Lantern is, asks one question, and offers the written days as an index", () => {
    renderStart();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(PROMISE);
    expect(screen.getByRole("textbox", { name: "Where, and anything else" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan this day" })).toBeInTheDocument();
    const cells = within(writtenDays()).getAllByRole("button");
    expect(cells.map((cell) => cell.textContent)).toEqual(
      INDEX_REQUESTS.map(({ city }) => expect.stringMatching(new RegExp(`^${city} `))),
    );
  });

  it("writes a start's day when it is pressed, from the keyboard too", async () => {
    const user = userEvent.setup();
    const { onChooseWritten } = renderStart();

    await user.click(within(writtenDays()).getByRole("button", { name: /^Paris / }));
    expect(onChooseWritten).toHaveBeenLastCalledWith(PARIS_REQUEST);

    // After the field and its button, the starts, in the order they are written.
    screen.getByRole("textbox").focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Plan this day" })).toHaveFocus();
    await user.tab();
    expect(within(writtenDays()).getByRole("button", { name: /^Paris / })).toHaveFocus();
    await user.tab();
    expect(within(writtenDays()).getByRole("button", { name: /^Madrid / })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChooseWritten).toHaveBeenLastCalledWith(MADRID_START_REQUEST);
  });

  it("keeps the starts on screen while a day is on its way, and the field its words", () => {
    renderStart({ line: { kind: "writing", request: LISBON_REQUEST } });
    const field = screen.getByRole("textbox", { name: "Where, and anything else" });

    expect(field).toHaveAttribute("readonly");
    expect(within(writtenDays()).getAllByRole("button")).toHaveLength(STARTS.length);
    expect(startStatus()).toHaveTextContent("Opening a lively Saturday in Lisbon, with friends");
  });

  it("says with live generation off that no new day is written, and with it on what happens next", () => {
    const { rerender, ...handlers } = renderStart();
    // The written days are named once, as the index below, not again in the note.
    expect(screen.getByText(NOT_LIVE_NOTE)).toBeInTheDocument();
    expect(screen.getAllByText("Paris")).toHaveLength(1);

    rerender(
      <HeldStart
        starts={STARTS}
        line={null}
        isLive
        isCityFocused
        onPlan={handlers.onPlan}
        onChooseWritten={handlers.onChooseWritten}
        onChooseReading={handlers.onChooseReading}
      />,
    );
    // Once live, nothing is said under the question: the field and its button say it.
    expect(screen.queryByText(NOT_LIVE_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByText(/one place at a time/)).not.toBeInTheDocument();
  });

  it("sets the question as one sentence, its button an arrow named for what a press does", () => {
    renderStart();

    // "A day in" starts the sentence the field ends; the field keeps its own name.
    expect(screen.getByText("A day in")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Where, and anything else" })).toBeInTheDocument();
    // The button says nothing in words: its arrow is unheard, and its name says what it does.
    const button = screen.getByRole("button", { name: "Plan this day" });
    expect(button).toHaveTextContent(/^$/);
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  it.each([
    [{ kind: "reading" } as const, false, "Reading"],
    [{ kind: "writing", request: LISBON_REQUEST } as const, true, "Writing"],
    [{ kind: "writing", request: LISBON_REQUEST } as const, false, "Opening"],
    [{ kind: "refused" } as const, true, "Plan this day"],
  ])("names the button for what Lantern is doing: %o, live %s", (line, isLive, name) => {
    renderStart({ line, isLive });

    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  });

  it("draws the field and the button still as pointed at, for a lab cell, without the focus", () => {
    const { rerender, onPlan, onChooseWritten, onChooseReading } = renderStart({
      drawnAsPointed: "field",
    });
    expect(screen.getByRole("textbox")).toHaveClass("border-b-2", "border-ink");
    expect(screen.getByRole("textbox")).not.toHaveFocus();

    rerender(
      <HeldStart
        starts={STARTS}
        line={null}
        isLive={false}
        isCityFocused
        onPlan={onPlan}
        onChooseWritten={onChooseWritten}
        onChooseReading={onChooseReading}
        drawnAsPointed="button"
      />,
    );
    expect(screen.getByRole("button", { name: "Plan this day" })).toHaveAttribute("data-pointed");
    expect(screen.getByRole("textbox")).toHaveClass("border-ink-soft");
  });

  it("plans the day from what was typed, and from nothing else", async () => {
    const user = userEvent.setup();
    const { onPlan } = renderStart();

    await user.click(screen.getByRole("button", { name: "Plan this day" }));
    expect(onPlan).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox"), "  Lisbon, with my dog {Enter}");
    expect(onPlan).toHaveBeenCalledWith("Lisbon, with my dog");
  });

  it("takes a sentence that wraps, never a second line, and asks for the day at Enter", async () => {
    const user = userEvent.setup();
    const { onPlan } = renderStart();
    const field = screen.getByRole("textbox", { name: "Where, and anything else" });
    expect(field).toHaveAttribute("rows", "1");

    await user.click(field);
    await user.paste("Lisbon on a Sunday,\nwith my mum\r\n");
    expect(field).toHaveValue("Lisbon on a Sunday, with my mum ");

    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(field).toHaveValue("Lisbon on a Sunday, with my mum ");
    expect(onPlan).toHaveBeenCalledWith("Lisbon on a Sunday, with my mum");
  });

  it("never asks for the day at the Enter that ends a composed word, Safari's either", async () => {
    const user = userEvent.setup();
    const { onPlan } = renderStart();
    const field = screen.getByRole("textbox", { name: "Where, and anything else" });
    await user.type(field, "Kyoto");

    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    // Safari's, after the composition has ended: only its key code says so.
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onPlan).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter", keyCode: 13 });
    expect(onPlan).toHaveBeenCalledWith("Kyoto");
  });

  it("holds the question while the text is read", async () => {
    const user = userEvent.setup();
    const { onPlan } = renderStart({ line: { kind: "reading" } });

    await user.type(screen.getByRole("textbox"), "Kyoto{Enter}");
    await user.click(screen.getByRole("button", { name: "Reading" }));
    expect(onPlan).not.toHaveBeenCalled();
  });

  it("says from the Enter what Lantern is doing, and draws the sign of work in the button", () => {
    renderStart({ line: { kind: "reading" }, wait: "reading" });

    // The line under the field says it in words, where the example stood, at the example's
    // size: a cold start's four seconds never stand still and unsaid.
    const said = startStatus();
    expect(said).toHaveTextContent(/^Reading what you wrote$/);
    expect(said).toHaveClass("text-body");
    expect(said).not.toHaveTextContent(/For example/);
    // The button is a lantern, framed in ink, with no light passing over it, and a press asks
    // nothing more while Lantern works.
    const button = screen.getByRole("button", { name: "Reading" });
    expect(button.querySelector('[data-part="pen"]')).not.toBeNull();
    expect(button).not.toHaveClass("motion-safe:animate-pass-steady");
    expect(button).not.toHaveClass("bg-ink");
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("asks for the city with the words it read, and says back what it could not place", () => {
    renderStart({
      line: {
        kind: "question",
        words: {
          ...NO_WORDS,
          energy: "calm",
          energySource: "chosen",
          start: "slow",
          company: "family",
        },
        readings: [],
        unplaced: ["by the sea"],
      },
    });

    const field = screen.getByRole("textbox", { name: "Which city?" });
    expect(field).toHaveValue("");
    expect(field).toHaveFocus();
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "A calm day in …?, slow morning, with family",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Lantern needs a city to plan the day. Name one, or pick one of the days below.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Lantern can't plan around “by the sea”.")).toBeInTheDocument();
  });

  it("keeps asking for the city while its answer is read and its day sets off", async () => {
    const user = userEvent.setup();
    const question = {
      kind: "question",
      words: { ...NO_WORDS, energy: "calm", energySource: "chosen", company: "family" },
      readings: [],
      unplaced: [],
    } as const;
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const startOf = (line: StartHeaderProps["line"]) => (
      <HeldStart starts={STARTS} line={line} isLive isCityFocused {...handlers} />
    );
    const view = render(startOf(question));
    const field = screen.getByRole("textbox", { name: "Which city?" });
    await user.type(field, "Porto");

    // The same field, still the city's and still in hand, holds the answer while it is read;
    // the answer stands in the sentence where "…?" stood, and what the question needed goes
    // unseen and unheard, keeping its room.
    view.rerender(startOf({ kind: "reading", answering: question }));
    expect(screen.getByRole("textbox", { name: "Which city?" })).toBe(field);
    expect(field).toHaveFocus();
    expect(field).toHaveValue("Porto");
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Reading" })).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "A calm day in Porto, with family"),
    ).toBeInTheDocument();
    const needed = screen.getByText(/Lantern needs a city to plan the day/);
    expect(needed.closest("[aria-hidden='true']")).not.toBeNull();
    // No press moved the focus to the button, so the status says the read to a screen reader.
    expect(answerStatus().textContent).toBe("Reading what you wrote");

    // Read, its day sets off from the same field.
    view.rerender(
      startOf({
        kind: "writing",
        request: { ...LISBON_REQUEST, city: "Porto", energy: "calm" },
        answering: question,
      }),
    );
    expect(screen.getByRole("textbox", { name: "Which city?" })).toBe(field);
    expect(screen.getByRole("button", { name: "Writing" })).toBeInTheDocument();
    // The question's lines hold their room until the day takes the page, and say what is
    // happening only to screen readers.
    expect(
      screen.getByText(/Lantern needs a city to plan the day/).closest("[aria-hidden='true']"),
    ).not.toBeNull();
    expect(
      screen.getByText((_, element) => element?.textContent === "A calm day in Porto, with family"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.classList.contains("sr-only") === true &&
          /^Writing a calm Saturday in Porto/.test(element.textContent ?? ""),
      ),
    ).toBeInTheDocument();
  });

  it("marks an energy the text did not name as Lantern's", () => {
    renderStart({ line: { kind: "question", words: NO_WORDS, readings: [], unplaced: [] } });

    expect(screen.getByText("balanced")).toHaveClass("underline");
  });

  it("names the word the key of an assumed energy marks, for assistive technology alone", () => {
    // "reflective" is shown as "quiet": the key names the word the sentence shows.
    const words = { ...NO_WORDS, energy: "reflective" } as const;
    renderStart({ line: { kind: "question", words, readings: [], unplaced: [] } });

    const key = screen.getByText("assumed", { selector: "span" }).closest("p")!;
    // Heard whole, from one hidden text; seen as it is drawn, the word unseen.
    const heard = textOutside(key, "[aria-hidden]");
    expect(heard).toBe("quiet is assumed by Lantern");
    expect(key.querySelector(".sr-only")?.childNodes).toHaveLength(1);
    expect(textOutside(key, ".sr-only, .invisible")).toBe("assumed by Lantern");
    // The status says the same key, as a sentence of its own.
    expect(answerStatus().textContent).toContain("Quiet is assumed by Lantern.");
  });

  it("draws no key under the sentence for an energy the text chose", () => {
    renderStart({
      line: {
        kind: "question",
        words: { ...NO_WORDS, energySource: "chosen" },
        readings: [],
        unplaced: [],
      },
    });

    expect(screen.queryByText(/assumed/)).not.toBeInTheDocument();
  });

  it("names the weekday only when the text named the date", () => {
    renderStart({
      line: {
        kind: "question",
        words: { ...NO_WORDS, date: "2026-11-15" },
        readings: [],
        unplaced: [],
      },
    });

    expect(screen.getByText("Sunday")).toBeInTheDocument();
  });

  it("offers the cities a shared name could be as answers", async () => {
    const user = userEvent.setup();
    const oregon = {
      placeId: "lab-portland-oregon",
      name: "Portland",
      region: "Oregon, United States",
      timezone: "America/Los_Angeles",
    };
    const { onChooseReading } = renderStart({
      line: {
        kind: "question",
        words: NO_WORDS,
        readings: [
          oregon,
          {
            placeId: "lab-portland-maine",
            name: "Portland",
            region: "Maine, United States",
            timezone: "America/New_York",
          },
        ],
        unplaced: [],
      },
    });

    await user.click(screen.getByRole("button", { name: "Portland, Oregon, United States" }));
    expect(onChooseReading).toHaveBeenCalledWith(oregon);
  });

  // The intake asks with one city when it named none and the lookup found only one.
  it("offers the one city found as the answer, rather than asking for a city at all", async () => {
    const user = userEvent.setup();
    const florida = {
      placeId: "lab-atlantis-florida",
      name: "Atlantis",
      region: "Florida, United States",
      timezone: "America/New_York",
    };
    const { onChooseReading } = renderStart({
      line: { kind: "question", words: NO_WORDS, readings: [florida], unplaced: [] },
    });

    expect(screen.queryByText(/Lantern needs a city/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atlantis, Florida, United States" }));
    expect(onChooseReading).toHaveBeenCalledWith(florida);
  });

  it.each([
    ["not-yet", "Lantern isn't writing new days right now."],
    ["refused", "Lantern can't plan that day."],
    ["limited", "Lantern has written all the days it can for now."],
  ] as const)("points to the index below when no day can be written (%s)", async (kind, said) => {
    const user = userEvent.setup();
    const { onChooseWritten } = renderStart({ line: { kind } });

    const line = screen.getByText(`${said} Start from one of the days below.`, { selector: "p" });
    expect(answerStatus()).toHaveTextContent(`${said} Start from one of the days below.`);
    // Said once, in place of the note, and the days are offered once, as the index below.
    expect(screen.queryByText(NOT_LIVE_NOTE)).not.toBeInTheDocument();
    expect(within(line).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByText("Paris")).toHaveLength(1);
    await user.click(within(writtenDays()).getByRole("button", { name: /^Paris / }));
    expect(onChooseWritten).toHaveBeenCalledWith(PARIS_REQUEST);
  });

  it("says with live generation on that the text could not be read, rather than that no days are written", () => {
    renderStart({ line: { kind: "not-yet" }, isLive: true });

    expect(answerStatus()).toHaveTextContent("Lantern couldn't read that just now.");
  });

  it("says each answer as a change of words in one status that stands, empty, from the start", () => {
    const question = {
      kind: "question",
      words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
      readings: [PORTLAND_OREGON, PORTLAND_MAINE],
      unplaced: [],
    } as const;
    const startOf = (line: StartHeaderProps["line"]) => (
      <HeldStart
        starts={STARTS}
        line={line}
        isLive
        isCityFocused
        onPlan={vi.fn()}
        onChooseWritten={vi.fn()}
        onChooseReading={vi.fn()}
      />
    );
    const view = render(startOf(null));
    const status = answerStatus();
    expect(status.textContent).toBe("");

    // The field drawn again for the city's answer leaves the status as it stands.
    view.rerender(startOf(question));
    expect(answerStatus()).toBe(status);
    expect(status.textContent).toBe(
      "A lively day in …? Portland, Oregon, United States, or Portland, Maine, United States.",
    );

    view.rerender(startOf({ kind: "refused" }));
    expect(answerStatus()).toBe(status);
    expect(status.textContent).toBe(
      "Lantern can't plan that day. Start from one of the days below.",
    );
    // The line seen is said once, by the status.
    const line = screen.getByText(
      "Lantern can't plan that day. Start from one of the days below.",
      { selector: "p" },
    );
    expect(line.closest("[role=status]")).toBeNull();
  });

  it("says the city's question in the words its lines show", () => {
    renderStart({
      line: {
        kind: "question",
        words: { ...NO_WORDS, energy: "calm", energySource: "chosen", company: "family" },
        readings: [],
        unplaced: ["by the sea"],
      },
    });

    expect(answerStatus().textContent).toBe(
      "A calm day in …?, with family. Lantern needs a city to plan the day. Name one, or pick one of the days below. Lantern can't plan around “by the sea”.",
    );
    // An energy the text chose has no key under the sentence, and none is said.
    expect(answerStatus().textContent).not.toContain(ASSUMED_NOTE);
    // Seen in lines of their own, and said once, by the status.
    expect(
      screen.getByText("Lantern can't plan around “by the sea”.").closest("[role=status]"),
    ).toBeNull();
  });

  it("says the key of an energy Lantern assumed where its lines show it, before the cities", () => {
    renderStart({
      line: { kind: "question", words: NO_WORDS, readings: [PORTLAND_OREGON], unplaced: [] },
    });

    expect(answerStatus().textContent).toBe(
      `A balanced day in …? Balanced is ${ASSUMED_NOTE}. Portland, Oregon, United States.`,
    );
  });

  it("names the assumed energy in its key, so a fact the text named never reads as assumed", () => {
    renderStart({
      line: {
        kind: "question",
        words: { ...NO_WORDS, energy: "reflective", company: "family" },
        readings: [],
        unplaced: [],
      },
    });

    expect(answerStatus().textContent).toBe(
      `A quiet day in …?, with family. Quiet is ${ASSUMED_NOTE}. Lantern needs a city to plan the day. Name one, or pick one of the days below.`,
    );
  });
});

/** The city's question, its name one of two cities. */
const PORTLAND_QUESTION = {
  kind: "question",
  words: { ...NO_WORDS, energy: "lively", energySource: "chosen" },
  readings: [PORTLAND_OREGON, PORTLAND_MAINE],
  unplaced: [],
} as const;
const PORTLAND_SAID =
  "A lively day in …? Portland, Oregon, United States, or Portland, Maine, United States.";
const REFUSED_SAID = "Lantern can't plan that day. Start from one of the days below.";

describe("how long the status holds an answer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The start as the page draws it for `line`, live, its wait set by the page. */
  const startOf = (line: StartHeaderProps["line"], wait: StartWait | null = null) => (
    <HeldStart
      starts={STARTS}
      line={line}
      wait={wait}
      isLive
      isCityFocused
      onPlan={vi.fn()}
      onChooseWritten={vi.fn()}
      onChooseReading={vi.fn()}
    />
  );
  const waitMs = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it.each([
    ["an ending without a day", { kind: "refused" } as const, REFUSED_SAID, "Lantern can't plan"],
    ["the city's question", PORTLAND_QUESTION, PORTLAND_SAID, "A lively day in"],
  ])(
    "holds %s for as long as it takes to be heard, then falls quiet while the line stays",
    (_, line, said, seen) => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const view = render(startOf(null));
      view.rerender(startOf(line));
      const shown = screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.closest("form") !== null &&
          (element.textContent ?? "").startsWith(seen),
      );
      const shownWords = shown.textContent;
      expect(answerStatus().textContent).toBe(said);

      waitMs(NOTICE_HEARD_MS - 1);
      expect(answerStatus().textContent).toBe(said);

      waitMs(1);
      expect(answerStatus().textContent).toBe("");
      expect(shown).toBeVisible();
      expect(shown.textContent).toBe(shownWords);
    },
  );

  it("holds the same answer afresh when a second press's wait has emptied the status", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const view = render(startOf({ kind: "refused" }));
    waitMs(NOTICE_HEARD_MS);
    expect(answerStatus().textContent).toBe("");

    // The press's wait empties it in the frame its line still draws the ending.
    view.rerender(startOf({ kind: "refused" }, "reading"));
    expect(answerStatus().textContent).toBe("");
    view.rerender(startOf({ kind: "reading" }, "reading"));
    view.rerender(startOf({ kind: "refused" }));
    expect(answerStatus().textContent).toBe(REFUSED_SAID);
  });

  it("holds an answer that comes back inside the hold for as long again", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const view = render(startOf({ kind: "refused" }));
    waitMs(NOTICE_HEARD_MS / 2);

    view.rerender(startOf({ kind: "reading" }, "reading"));
    view.rerender(startOf({ kind: "refused" }));
    // Past the moment the first hold would have ended.
    waitMs(NOTICE_HEARD_MS / 2 + 1);
    expect(answerStatus().textContent).toBe(REFUSED_SAID);

    waitMs(NOTICE_HEARD_MS / 2);
    expect(answerStatus().textContent).toBe("");
  });

  it("says what an answer under way is doing for as long as its wait", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const view = render(startOf(PORTLAND_QUESTION));
    view.rerender(startOf({ kind: "reading", answering: PORTLAND_QUESTION }, "reading"));

    waitMs(NOTICE_HEARD_MS * 2);
    expect(answerStatus().textContent).toBe("Reading what you wrote");
  });
});

describe("the field's description after an answer without a day", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The question for a city when the text named none. */
  const NO_CITY_QUESTION = {
    kind: "question",
    words: NO_WORDS,
    readings: [],
    unplaced: [],
  } as const;
  const NEEDS_CITY_SAID =
    "Lantern needs a city to plan the day. Name one, or pick one of the days below.";

  /** The start as the page draws it for `line` and `wait`. */
  const startOf = (line: StartHeaderProps["line"], wait: StartWait | null, isLive = true) => (
    <HeldStart
      starts={STARTS}
      line={line}
      wait={wait}
      isLive={isLive}
      isCityFocused={line?.kind === "question"}
      onPlan={vi.fn()}
      onChooseWritten={vi.fn()}
      onChooseReading={vi.fn()}
    />
  );
  const waitMs = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  /** A typed text read, the focus on the button named for it, as a press leaves it. */
  const renderRead = (isLive = true) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const view = render(startOf({ kind: "reading" }, "reading", isLive));
    act(() => screen.getByRole("button", { name: "Reading" }).focus());
    return view;
  };

  it("names the ending's line once the status has said it, with the room left beside it", () => {
    const view = renderRead();
    view.rerender(startOf({ kind: "refused" }, null));
    const field = screen.getByRole("textbox", { name: "Where, and anything else" });
    expect(field).toHaveFocus();
    // Said by the status as the focus lands, so not by the field too.
    expect(field).not.toHaveAttribute("aria-describedby");

    waitMs(NOTICE_HEARD_MS);
    expect(field).toHaveAccessibleDescription(REFUSED_SAID);

    fireEvent.change(field, { target: { value: "a".repeat(MAX_INTAKE_TEXT_CHARS) } });
    expect(field).toHaveAccessibleDescription(`${REFUSED_SAID} 0 left`);
  });

  it.each([
    ["a city", NO_CITY_QUESTION, NEEDS_CITY_SAID],
    [
      "one of the cities a name could be",
      PORTLAND_QUESTION,
      "Portland, Oregon, United States Portland, Maine, United States",
    ],
  ])("names what the city's question needs, %s, when a text turns to it", (_, question, said) => {
    const view = renderRead();
    view.rerender(startOf(question, null));
    const field = screen.getByRole("textbox", { name: "Which city?" });
    expect(field).toHaveFocus();

    waitMs(NOTICE_HEARD_MS);
    expect(field).toHaveAccessibleDescription(said);
  });

  it("names the ending's line when an answer to the city's question is read to no day", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const view = render(startOf(NO_CITY_QUESTION, null));
    view.rerender(startOf({ kind: "reading", answering: NO_CITY_QUESTION }, "reading"));
    act(() => screen.getByRole("button", { name: "Reading" }).focus());
    view.rerender(startOf({ kind: "refused" }, null));
    const field = screen.getByRole("textbox", { name: "Where, and anything else" });
    expect(field).toHaveFocus();

    waitMs(NOTICE_HEARD_MS);
    expect(field).toHaveAccessibleDescription(REFUSED_SAID);
  });

  it("names nothing with live generation off, where the focus stays on the button", () => {
    const view = renderRead(false);
    // The read ends with no day on its way; the ending comes after, with no wait to end.
    view.rerender(startOf({ kind: "reading" }, null, false));
    view.rerender(startOf({ kind: "not-yet" }, null, false));

    waitMs(NOTICE_HEARD_MS);
    expect(screen.getByRole("button", { name: "Plan this day" })).toHaveFocus();
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
  });

  it("names nothing from the press that asks again, while the line still draws the ending", () => {
    const view = renderRead();
    view.rerender(startOf({ kind: "refused" }, null));
    waitMs(NOTICE_HEARD_MS);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby");

    view.rerender(startOf({ kind: "refused" }, "reading"));
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
  });

  it("names nothing once the line has left the ending the focus came back with", () => {
    const view = renderRead();
    view.rerender(startOf({ kind: "refused" }, null));
    waitMs(NOTICE_HEARD_MS);
    // A day pressed in the index, with no typed wait, that ends without a day too.
    view.rerender(startOf(ON_ITS_WAY_LIVE, null));
    view.rerender(startOf({ kind: "not-yet" }, null));

    waitMs(NOTICE_HEARD_MS);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
  });
});

/** The motion-safe loop of the sign, on its pen: present only while it runs. */
const PEN_LOOP = "motion-safe:animate-sign-cut";

/** The sign of work in the start button, or null where the arrow stands. */
function signInButton(): Element | null {
  const button = screen.getByRole("button", { name: /^(Plan this day|Reading|Writing|Opening)$/ });
  return button.querySelector("svg:has([data-part='pen'])");
}

/** Every plate's frame in the index, and whether it stands stepped back. */
function steppedBackPlates(): boolean[] {
  return [...document.querySelectorAll("svg[data-picture]")].map(
    (plate) => plate.closest("[data-stepped-back]") !== null,
  );
}

/** A day on its way, as the line says it back. */
const ON_ITS_WAY_LIVE = { kind: "writing", request: LISBON_REQUEST } as const;

describe("the wait that follows a typed text", () => {
  const ON_ITS_WAY = ON_ITS_WAY_LIVE;

  it.each([
    ["while its text is read", { kind: "reading" } as const, "reading"],
    ["while its day is opened", ON_ITS_WAY, "opening"],
    ["while its day is written", ON_ITS_WAY, "writing"],
  ] as const)("draws the sign of work, running, in a hollow frame %s", (_, line, wait) => {
    renderStart({ line, wait, isLive: true });

    const sign = signInButton();
    expect(sign).not.toBeNull();
    expect(sign?.querySelector("[data-part='pen']")).toHaveClass(PEN_LOOP);
    const button = screen.getByRole("button", { name: /^(Reading|Opening|Writing)$/ });
    expect(button).toHaveClass("border-ink");
    expect(button).not.toHaveClass("bg-ink");
    expect(button).not.toHaveClass("motion-safe:animate-pass-steady");
  });

  it.each([
    ["at rest", null],
    ["once the wait ends without a day", { kind: "refused" } as const],
  ])("draws the arrow, not the sign, %s", (_, line) => {
    renderStart({ line, isLive: true });
    expect(signInButton()).toBeNull();
  });

  it("lights a city pressed in the index with the steady light, and draws no sign", () => {
    renderStart({ line: ON_ITS_WAY, isLive: true });
    const button = screen.getByRole("button", { name: "Writing" });
    expect(button).toHaveClass("bg-ink", "motion-safe:animate-pass-steady");
    expect(signInButton()).toBeNull();
  });

  it("says a day being written takes under a minute, its dot tied to the words", () => {
    renderStart({ line: ON_ITS_WAY, wait: "writing", isLive: true });
    expect(startStatus().textContent).toBe(
      "Writing a lively Saturday in Lisbon, with friends ·\u00A0under\u00A0a\u00A0minute",
    );
  });

  it("says nothing of a minute for a city pressed in the index", () => {
    renderStart({ line: ON_ITS_WAY, isLive: true });
    expect(startStatus()).toHaveTextContent(/^Writing a lively Saturday in Lisbon, with friends$/);
  });

  it.each([
    ["a typed text's day from its file, live", "opening", true, "Opening", ""],
    ["a typed text's day from its file, before launch", "opening", false, "Opening", ""],
    [
      "a typed text's day no file holds, live",
      "writing",
      true,
      "Writing",
      " ·\u00A0under\u00A0a\u00A0minute",
    ],
    ["a city pressed, live", null, true, "Writing", ""],
    ["a city pressed, before launch", null, false, "Opening", ""],
  ] as const)(
    "names %s with one verb, in the line and on the button",
    (_, wait, isLive, verb, minute) => {
      renderStart({ line: ON_ITS_WAY, wait, isLive });
      expect(startStatus().textContent).toBe(
        `${verb} a lively Saturday in Lisbon, with friends${minute}`,
      );
      expect(screen.getByRole("button", { name: verb })).toBeInTheDocument();
    },
  );

  it("steps every plate back through a typed wait, and none for a city pressed", () => {
    const view = renderStart({ line: { kind: "reading" }, wait: "reading" });
    const plates = steppedBackPlates();
    expect(plates.length).toBeGreaterThan(0);
    expect(plates.every(Boolean)).toBe(true);

    view.rerender(
      <HeldStart
        starts={STARTS}
        line={ON_ITS_WAY}
        wait={null}
        isLive={false}
        isCityFocused
        onPlan={vi.fn()}
        onChooseWritten={vi.fn()}
        onChooseReading={vi.fn()}
      />,
    );
    expect(steppedBackPlates().some(Boolean)).toBe(false);
  });

  it("keeps every city's name at its strength and pressable, its plate whole once pointed at", async () => {
    const user = userEvent.setup();
    const { onChooseWritten } = renderStart({ line: { kind: "reading" }, wait: "reading" });
    const [first] = within(writtenDays()).getAllByRole("button");
    if (!first) throw new Error("No start in the index");

    // Only the picture steps back: the names and the lines under them are outside it.
    expect(
      within(first)
        .getByText(INDEX_REQUESTS[0]?.city ?? "")
        .closest("[data-stepped-back]"),
    ).toBeNull();
    fireEvent.pointerEnter(first, { pointerType: "mouse" });
    expect(first.querySelector("[data-stepped-back]")).toBeNull();
    expect(first.querySelector("svg[data-picture]")).toHaveAttribute("data-light", "lit");
    await user.click(first);
    expect(onChooseWritten).toHaveBeenCalledOnce();
  });
});

/** What the start's status holds that a screen reader hears: its words outside what is hidden. */
function heardStatus(): string | null {
  const copy = startStatus().cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll("[aria-hidden='true']")) hidden.remove();
  return copy.textContent;
}

describe("the press that asks for a typed text", () => {
  it("asks for the text, then hands the focus to the button, named Reading as the focus lands", async () => {
    const user = userEvent.setup();
    const named: string[] = [];
    let isAskedBeforeFocus = false;
    const onPlan = vi.fn();
    renderStart({ onPlan, waitAtPlan: "reading" });
    const field = screen.getByRole("textbox", { name: "Where, and anything else" });
    await user.type(field, "Bologna");
    const button = screen.getByRole("button", { name: "Plan this day" });
    button.addEventListener("focus", () => {
      named.push(button.getAttribute("aria-label") ?? "");
      isAskedBeforeFocus = onPlan.mock.calls.length > 0;
    });

    await user.keyboard("{Enter}");
    expect(button).toHaveFocus();
    expect(named).toEqual(["Reading"]);
    expect(isAskedBeforeFocus).toBe(true);
    expect(onPlan).toHaveBeenCalledWith("Bologna");
  });

  it("draws the sign and steps the plates back from the press, as the page starts the wait", async () => {
    const user = userEvent.setup();
    renderStart({ waitAtPlan: "reading" });
    await user.type(screen.getByRole("textbox"), "Bologna{Enter}");

    expect(signInButton()).not.toBeNull();
    expect(steppedBackPlates().every(Boolean)).toBe(true);
  });

  it("gives the focus back to the field when the wait ends without a day", async () => {
    const user = userEvent.setup();
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const startOf = (line: StartHeaderProps["line"], wait?: StartWait | null) => (
      <HeldStart
        starts={STARTS}
        line={line}
        wait={wait}
        waitAtPlan="reading"
        isLive
        isCityFocused={false}
        {...handlers}
      />
    );
    const view = render(startOf(null));
    const field = screen.getByRole("textbox");
    await user.type(field, "Paris{Enter}");
    view.rerender(startOf({ kind: "reading" }));
    expect(screen.getByRole("button", { name: "Reading" })).toHaveFocus();

    view.rerender(startOf({ kind: "not-yet" }, null));
    await waitFor(() => expect(field).toHaveFocus());
  });

  it("gives the focus back to the city's field when its answer asks for the city again", async () => {
    const user = userEvent.setup();
    const question = {
      kind: "question",
      words: { ...NO_WORDS, company: "friends" },
      readings: [],
      unplaced: [],
    } as const;
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const startOf = (line: StartHeaderProps["line"], wait?: StartWait | null) => (
      <HeldStart
        starts={STARTS}
        line={line}
        wait={wait}
        waitAtPlan="reading"
        isLive
        isCityFocused
        {...handlers}
      />
    );
    const view = render(startOf(question));
    const field = screen.getByRole("textbox", { name: "Which city?" });
    await user.type(field, "Portland{Enter}");
    view.rerender(startOf({ kind: "reading", answering: question }));
    expect(screen.getByRole("button", { name: "Reading" })).toHaveFocus();
    // Said as the focus landed, so not again under the question.
    expect(screen.queryByText("Reading what you wrote")).not.toBeInTheDocument();

    view.rerender(
      startOf(
        {
          ...question,
          readings: [
            { placeId: "a", name: "Portland", region: "Oregon", timezone: "America/Los_Angeles" },
            { placeId: "b", name: "Portland", region: "Maine", timezone: "America/New_York" },
          ],
        },
        null,
      ),
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Which city?" })).toHaveFocus());
  });

  it("says Reading where the focus lands at an Enter in the city's field, and leaves the status empty while the line reads", async () => {
    const user = userEvent.setup();
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const startOf = (line: StartHeaderProps["line"]) => (
      <HeldStart
        starts={STARTS}
        line={line}
        waitAtPlan="reading"
        isLive
        isCityFocused
        {...handlers}
      />
    );
    const view = render(startOf(PORTLAND_QUESTION));
    await user.type(screen.getByRole("textbox", { name: "Which city?" }), "Portland, Oregon");
    const named: string[] = [];
    const button = screen.getByRole("button", { name: "Plan this day" });
    button.addEventListener("focus", () => named.push(button.getAttribute("aria-label") ?? ""));

    await user.keyboard("{Enter}");
    view.rerender(startOf({ kind: "reading", answering: PORTLAND_QUESTION }));
    expect(button).toHaveFocus();
    expect(named).toEqual(["Reading"]);
    expect(answerStatus().textContent).toBe("");
    // The line still reads the answer in the sentence where "…?" stood.
    expect(
      screen.getByText((_, element) => element?.textContent === "A lively day in Portland, Oregon"),
    ).toBeVisible();
  });

  it("says Reading once, on the button the focus moves to from the field, and Writing once, in the status", async () => {
    const user = userEvent.setup();
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const view = renderStart({ isLive: true, waitAtPlan: "reading", ...handlers });
    await user.type(screen.getByRole("textbox"), "Lisbon{Enter}");
    view.rerender(
      <HeldStart starts={STARTS} line={{ kind: "reading" }} isLive isCityFocused {...handlers} />,
    );
    expect(screen.getByRole("button", { name: "Reading" })).toHaveFocus();
    expect(heardStatus()).toBe("");
    expect(startStatus()).toHaveTextContent("Reading what you wrote");

    view.rerender(
      <HeldStart
        starts={STARTS}
        line={ON_ITS_WAY_LIVE}
        wait="writing"
        isLive
        isCityFocused
        {...handlers}
      />,
    );
    expect(heardStatus()).toMatch(/^Writing a lively Saturday in Lisbon/);
    expect(screen.getByRole("button", { name: "Writing" })).toBeInTheDocument();
  });

  it("keeps Reading said by the focus through a second press before the line says it", async () => {
    const user = userEvent.setup();
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const view = renderStart({ waitAtPlan: "reading", ...handlers });
    const field = screen.getByRole("textbox");
    await user.type(field, "Lisbon{Enter}");
    // A second press, from the button the focus is now on, before the line turns to the read.
    const form = field.closest("form");
    if (!form) throw new Error("No form");
    act(() => form.requestSubmit());
    view.rerender(
      <HeldStart
        starts={STARTS}
        line={{ kind: "reading" }}
        isLive={false}
        isCityFocused
        {...handlers}
      />,
    );
    expect(screen.getByRole("button", { name: "Reading" })).toHaveFocus();
    expect(heardStatus()).toBe("");
  });

  it("says Reading where the focus lands when a press on the button left the focus in the field, as WebKit's click does", async () => {
    const user = userEvent.setup();
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const view = renderStart({ waitAtPlan: "reading", ...handlers });
    const field = screen.getByRole("textbox");
    await user.type(field, "Lisbon");
    const button = screen.getByRole("button", { name: "Plan this day" });
    // A click that sends the form and leaves the focus where it was.
    fireEvent.click(button);
    view.rerender(
      <HeldStart
        starts={STARTS}
        line={{ kind: "reading" }}
        isLive={false}
        isCityFocused
        {...handlers}
      />,
    );
    expect(button).toHaveFocus();
    expect(heardStatus()).toBe("");
  });

  it("says Reading in the status where a press on the button found the focus on it already", async () => {
    const user = userEvent.setup();
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const view = renderStart({ waitAtPlan: "reading", ...handlers });
    await user.type(screen.getByRole("textbox"), "Lisbon");
    const button = screen.getByRole("button", { name: "Plan this day" });
    await user.click(button);
    view.rerender(
      <HeldStart
        starts={STARTS}
        line={{ kind: "reading" }}
        isLive={false}
        isCityFocused
        {...handlers}
      />,
    );
    expect(button).toHaveFocus();
    expect(heardStatus()).toBe("Reading what you wrote");
    expect(answerStatus().textContent).toBe("");
  });

  describe("after an ending, which takes the line under the field from the page", () => {
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    const startOf = (line: StartHeaderProps["line"], wait?: StartWait | null) => (
      <HeldStart
        starts={STARTS}
        line={line}
        wait={wait}
        waitAtPlan="reading"
        isLive
        isCityFocused={false}
        {...handlers}
      />
    );

    it.each([
      [
        "a click",
        (button: HTMLElement, user: ReturnType<typeof userEvent.setup>) => user.click(button),
      ],
      [
        "Enter",
        async (button: HTMLElement, user: ReturnType<typeof userEvent.setup>) => {
          act(() => button.focus());
          await user.keyboard("{Enter}");
        },
      ],
    ] as const)(
      "says Reading from the status over the form, once, at %s on the button the focus is on",
      async (_, press) => {
        const user = userEvent.setup();
        const view = render(startOf({ kind: "refused" }));
        await user.type(screen.getByRole("textbox"), "a quiet day");
        const button = screen.getByRole("button", { name: "Plan this day" });

        await press(button, user);
        view.rerender(startOf({ kind: "reading" }));
        expect(button).toHaveFocus();
        expect(answerStatus().textContent).toBe("Reading what you wrote");
        // Seen under the field, and unheard there: the line is drawn afresh holding it.
        expect(startStatus()).toHaveTextContent("Reading what you wrote");
        expect(heardStatus()).toBe("");

        // The day set off is said by the line, now standing, and no longer over the form.
        view.rerender(startOf(ON_ITS_WAY_LIVE, "writing"));
        expect(answerStatus().textContent).toBe("");
        expect(heardStatus()).toMatch(/^Writing a lively Saturday in Lisbon/);
      },
    );

    it("says Reading where the focus lands at an Enter in the field, and from no status", async () => {
      const user = userEvent.setup();
      const view = render(startOf({ kind: "refused" }));
      const button = screen.getByRole("button", { name: "Plan this day" });
      const named: string[] = [];
      button.addEventListener("focus", () => named.push(button.getAttribute("aria-label") ?? ""));

      await user.type(screen.getByRole("textbox"), "a quiet day{Enter}");
      view.rerender(startOf({ kind: "reading" }));
      expect(named).toEqual(["Reading"]);
      expect(answerStatus().textContent).toBe("");
      expect(heardStatus()).toBe("");
    });
  });
});

describe("a day set on its way straight after an ending, with no read drawn", () => {
  const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
  const startOf = (line: StartHeaderProps["line"], isLive: boolean, wait?: StartWait | null) => (
    <HeldStart
      starts={STARTS}
      line={line}
      wait={wait}
      waitAtPlan="reading"
      isLive={isLive}
      isCityFocused={false}
      {...handlers}
    />
  );

  it("says a city pressed in the index after a refusal from the status over the form", () => {
    const view = render(startOf({ kind: "refused" }, true, null));
    const overForm = answerStatus();

    view.rerender(startOf({ ...ON_ITS_WAY_LIVE }, true, null));
    expect(answerStatus()).toBe(overForm);
    expect(overForm).toHaveTextContent(/^Writing a lively Saturday in Lisbon, with friends$/);
    // Seen under the field, and unheard there: the line is drawn afresh holding it.
    expect(startStatus()).toHaveTextContent(/^Writing a lively Saturday in Lisbon, with friends$/);
    expect(heardStatus()).toBe("");

    // Drawn again as it stands, it is said where it was.
    view.rerender(startOf({ ...ON_ITS_WAY_LIVE }, true, null));
    expect(overForm).toHaveTextContent(/^Writing a lively Saturday in Lisbon/);
    expect(heardStatus()).toBe("");
  });

  it("says a typed text's day answered before its read is drawn from the status over the form", async () => {
    const user = userEvent.setup();
    const view = render(startOf({ kind: "not-yet" }, false));
    await user.type(screen.getByRole("textbox"), "London, with friends{Enter}");

    view.rerender(startOf(ON_ITS_WAY_LIVE, false, "opening"));
    expect(screen.getByRole("button", { name: "Opening" })).toHaveFocus();
    expect(answerStatus()).toHaveTextContent(/^Opening a lively Saturday in Lisbon, with friends$/);
    expect(startStatus()).toHaveTextContent(/^Opening a lively Saturday in Lisbon/);
    expect(heardStatus()).toBe("");
  });

  it("leaves a day set on its way from the line at rest to the line under the field", () => {
    const view = render(startOf({ kind: "refused" }, true, null));
    view.rerender(startOf(ON_ITS_WAY_LIVE, true, null));
    view.rerender(startOf(null, true, null));

    view.rerender(startOf(ON_ITS_WAY_LIVE, true, null));
    expect(answerStatus().textContent).toBe("");
    expect(heardStatus()).toMatch(/^Writing a lively Saturday in Lisbon/);
  });
});

/** What the page draws the start screen as once a city is chosen: its line, and its wait. */
interface Chosen {
  line: StartHeaderProps["line"];
  wait: StartWait | null;
}

/**
 * The city's question, its line and wait set as the choice of a city sets them, as `Day` sets
 * them in the press's own handler; with nothing chosen, the question stands, as a choice that
 * sets no day off leaves it.
 */
function ChoosingStart({
  chosen,
  onChooseReading,
  ...props
}: Omit<HeldStartProps, "line" | "wait" | "waitAtPlan"> & { chosen: Chosen | null }) {
  const [shown, setShown] = useState<Chosen>({ line: PORTLAND_QUESTION, wait: null });
  const choose = (reading: CityReading) => {
    onChooseReading(reading);
    if (chosen) setShown(chosen);
  };
  return <HeldStart {...props} line={shown.line} wait={shown.wait} onChooseReading={choose} />;
}

/** Portland, Oregon, chosen: its day set off, from the question it answers. */
const PORTLAND_SET_OFF: Chosen = {
  line: {
    kind: "writing",
    request: {
      ...LISBON_REQUEST,
      city: "Portland",
      energy: "lively",
      timezone: PORTLAND_OREGON.timezone,
    },
    answering: PORTLAND_QUESTION,
  },
  wait: "writing",
};

describe("a city chosen among those a shared name could be", () => {
  function renderChoosing(chosen: Chosen | null) {
    const handlers = { onPlan: vi.fn(), onChooseWritten: vi.fn(), onChooseReading: vi.fn() };
    render(
      <ChoosingStart starts={STARTS} isLive isCityFocused={false} chosen={chosen} {...handlers} />,
    );
    const button = screen.getByRole("button", { name: "Plan this day" });
    const named: string[] = [];
    button.addEventListener("focus", () => named.push(button.getAttribute("aria-label") ?? ""));
    const reading = screen.getByRole("button", { name: "Portland, Oregon, United States" });
    return { ...handlers, button, named, reading };
  }

  it.each([
    [
      "Enter",
      async (reading: HTMLElement, user: ReturnType<typeof userEvent.setup>) => {
        act(() => reading.focus());
        await user.keyboard("{Enter}");
      },
    ],
    [
      "a click",
      (reading: HTMLElement, user: ReturnType<typeof userEvent.setup>) => user.click(reading),
    ],
  ] as const)(
    "hands the focus to the button, named Writing as it lands, at %s on a city",
    async (_, press) => {
      const user = userEvent.setup();
      const { onChooseReading, button, named, reading } = renderChoosing(PORTLAND_SET_OFF);

      await press(reading, user);
      expect(onChooseReading).toHaveBeenCalledWith(PORTLAND_OREGON);
      expect(reading).not.toBeInTheDocument();
      expect(button).toHaveFocus();
      expect(named).toEqual(["Writing"]);
      // The day set off is said back from the status over the form, as for a city typed.
      expect(answerStatus().textContent).toMatch(/^Writing a lively \w+ in Portland/);
    },
  );

  it("leaves the focus on the city pressed when the choice sets no day off", async () => {
    const user = userEvent.setup();
    const { onChooseReading, button, named, reading } = renderChoosing(null);

    act(() => reading.focus());
    await user.keyboard("{Enter}");
    expect(onChooseReading).toHaveBeenCalledWith(PORTLAND_OREGON);
    expect(reading).toHaveFocus();
    expect(button).toHaveAccessibleName("Plan this day");
    expect(named).toEqual([]);
  });

  it("says Reading where the focus lands, and from no status, when the city chosen is read first", async () => {
    // The page sets a chosen city's day off at once, so its line is "writing" there; a header
    // given a read first takes the typed path's guard through the same hand-off.
    const user = userEvent.setup();
    const { button, named, reading } = renderChoosing({
      line: { kind: "reading", answering: PORTLAND_QUESTION },
      wait: "reading",
    });

    act(() => reading.focus());
    await user.keyboard("{Enter}");
    expect(button).toHaveFocus();
    expect(named).toEqual(["Reading"]);
    expect(answerStatus().textContent).toBe("");
  });
});

describe("the visitor's days over the starts", () => {
  const DAY: YourDay = {
    id: "a",
    request: LISBON_REQUEST,
    startedAt: new Date().toISOString(),
    energies: ["calm", "lively"],
    ending: "written",
    seconds: 46,
  };
  const yourDays = (onForget = vi.fn()) => ({ days: [DAY], onOpen: vi.fn(), onForget });
  const props = {
    starts: STARTS,
    line: null,
    text: "",
    onTextChange: vi.fn(),
    isLive: false,
    isCityFocused: false,
    onPlan: vi.fn(),
    wait: null,
    onChooseWritten: vi.fn(),
    onChooseReading: vi.fn(),
  };

  it("draws the index once the list is read, so the list never pushes it down", () => {
    expect(renderToString(<StartHeader {...props} yourDays={yourDays()} />)).not.toContain(
      INDEX_LABEL,
    );
    // A header with no list of the visitor's, as a lab's, draws its index on the server.
    expect(renderToString(<StartHeader {...props} />)).toContain(INDEX_LABEL);
  });

  it("hands the focus to the first start once the days are forgotten", async () => {
    const user = userEvent.setup();
    const onForget = vi.fn();
    render(<StartHeader {...props} yourDays={yourDays(onForget)} />);

    await user.click(screen.getByRole("button", { name: FORGET_YOUR_DAYS }));
    expect(onForget).not.toHaveBeenCalled();
    await waitOutADoublePress();
    await user.click(screen.getByRole("button", { name: FORGET_ANSWER }));

    expect(onForget).toHaveBeenCalledOnce();
    await waitFor(() => expect(within(writtenDays()).getAllByRole("button")[0]).toHaveFocus());
  });

  it("hands the focus to its headline when Back shows it again", () => {
    render(<StartHeader {...props} isReturnedTo />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });
});

describe("the field's room", () => {
  /** A text this many characters long. */
  const textOf = (length: number) => "a".repeat(length);
  const field = () => screen.getByRole("textbox", { name: "Where, and anything else" });

  it("takes no more than Lantern reads", () => {
    renderStart();

    expect(field()).toHaveAttribute("maxLength", String(MAX_INTAKE_TEXT_CHARS));
  });

  it("says nothing of its room while a text is short", async () => {
    const user = userEvent.setup();
    renderStart();

    await user.click(field());
    await user.paste(textOf(MAX_INTAKE_TEXT_CHARS - 41));

    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
    expect(field()).not.toHaveAccessibleDescription();
  });

  it("says one thing under the field: the example, or the room left once it is said", async () => {
    const user = userEvent.setup();
    renderStart();
    const example = () =>
      screen.queryByText("For example: London, with friends", { selector: "p" });
    expect(example()).toBeInTheDocument();

    await user.click(field());
    await user.paste(textOf(MAX_INTAKE_TEXT_CHARS - 41));
    expect(example()).toBeInTheDocument();

    await user.paste(textOf(1));
    expect(screen.getByText("40 left")).toBeInTheDocument();
    expect(example()).not.toBeInTheDocument();
  });

  it.each([
    [{ kind: "reading" } as const],
    [{ kind: "writing", request: LISBON_REQUEST } as const],
  ])("says no room left while Lantern works: %o", (line) => {
    render(
      <StartHeader
        starts={STARTS}
        line={line}
        text={textOf(MAX_INTAKE_TEXT_CHARS)}
        onTextChange={vi.fn()}
        wait={null}
        isLive
        isCityFocused={false}
        onPlan={vi.fn()}
        onChooseWritten={vi.fn()}
        onChooseReading={vi.fn()}
      />,
    );

    expect(field()).toHaveValue(textOf(MAX_INTAKE_TEXT_CHARS));
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
    expect(field()).not.toHaveAccessibleDescription();
  });

  it("says the room left beside a line that can write no day", () => {
    renderStart({ line: { kind: "limited" } });
    fireEvent.change(field(), { target: { value: textOf(MAX_INTAKE_TEXT_CHARS - 30) } });

    expect(answerStatus()).toHaveTextContent(/^Lantern has written all the days/);
    expect(field()).toHaveAccessibleDescription("30 left");
  });

  it("says the room left near its end, as the field's description, and none past it", async () => {
    const user = userEvent.setup();
    renderStart();

    await user.click(field());
    await user.paste(textOf(MAX_INTAKE_TEXT_CHARS - 40));
    expect(field()).toHaveAccessibleDescription("40 left");

    // A longer paste is cut at the end of the room, and says so.
    await user.paste(textOf(100));
    expect(field()).toHaveValue(textOf(MAX_INTAKE_TEXT_CHARS));
    expect(field()).toHaveAccessibleDescription("0 left");
  });
});
