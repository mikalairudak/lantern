import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { INDEX_REQUESTS, PARIS_REQUEST } from "@/lib/days/written/city-days";
import { MADRID_START_REQUEST } from "@/lib/days/written/quick-starts";
import { MAX_INTAKE_TEXT_CHARS, type IntakeWords } from "@/lib/schema/intake.schema";
import { NOT_LIVE_NOTE, PROMISE, StartHeader, type StartHeaderProps } from "./start-header";
import { INDEX_LABEL } from "./start-index";
import { startOffersOf } from "./start-offers";
import { writtenPool } from "./written-pool";
import type { YourDay } from "./your-days";
import { FORGET_ANSWER, FORGET_ANSWER_WAIT_MS } from "./your-days-ledger";
import { FORGET_YOUR_DAYS } from "./your-days-ledger-words";

/** "Forget" takes a press only once a double press on "Forget these days" is over. */
const waitOutADoublePress = () => new Promise((done) => setTimeout(done, FORGET_ANSWER_WAIT_MS));

/** The written days as the index offers them. */
const STARTS = startOffersOf(writtenPool());

/** The start's own status: the theme's button in the masthead says its look in one too. */
function startStatus(): HTMLElement {
  const [line, ...others] = screen
    .getAllByRole("status")
    .filter((status) => !status.hasAttribute("data-theme-status"));
  if (!line || others.length > 0) throw new Error("Not one status of the start's own");
  return line;
}

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

/** The header with its text held as the day holds it. */
function HeldStart(props: Omit<StartHeaderProps, "text" | "onTextChange">) {
  const [text, setText] = useState("");
  return <StartHeader {...props} text={text} onTextChange={setText} />;
}

function renderStart(props: Partial<StartHeaderProps> = {}) {
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
    renderStart({ line: { kind: "writing", request: LISBON_REQUEST, via: "pressed" } });
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
    [{ kind: "writing", request: LISBON_REQUEST, via: "typed" } as const, true, "Writing"],
    [{ kind: "writing", request: LISBON_REQUEST, via: "typed" } as const, false, "Opening"],
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
    renderStart({ line: { kind: "reading" } });

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
    expect(screen.getByText("Reading what you wrote")).toHaveClass("sr-only");

    // Read, its day sets off from the same field.
    view.rerender(
      startOf({
        kind: "writing",
        request: { ...LISBON_REQUEST, city: "Porto", energy: "calm" },
        via: "typed",
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

    expect(within(startStatus()).getByText("balanced")).toHaveClass("underline");
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

    const line = startStatus();
    expect(line).toHaveTextContent(`${said} Start from one of the days below.`);
    // Said once, in place of the note, and the days are offered once, as the index below.
    expect(screen.queryByText(NOT_LIVE_NOTE)).not.toBeInTheDocument();
    expect(within(line).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByText("Paris")).toHaveLength(1);
    await user.click(within(writtenDays()).getByRole("button", { name: /^Paris / }));
    expect(onChooseWritten).toHaveBeenCalledWith(PARIS_REQUEST);
  });

  it("says with live generation on that the text could not be read, rather than that no days are written", () => {
    renderStart({ line: { kind: "not-yet" }, isLive: true });

    expect(startStatus()).toHaveTextContent("Lantern couldn't read that just now.");
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

describe("the wait that follows a typed text", () => {
  const TYPED = { kind: "writing", request: LISBON_REQUEST, via: "typed" } as const;
  const PRESSED = { kind: "writing", request: LISBON_REQUEST, via: "pressed" } as const;

  it.each([
    ["while its text is read", { kind: "reading" } as const],
    ["while its day is on its way", TYPED],
  ])("draws the sign of work, running, in a hollow frame %s", (_, line) => {
    renderStart({ line, isLive: true });

    const sign = signInButton();
    expect(sign).not.toBeNull();
    expect(sign?.querySelector("[data-part='pen']")).toHaveClass(PEN_LOOP);
    const button = screen.getByRole("button", { name: /^(Reading|Writing)$/ });
    expect(button).toHaveClass("border-ink");
    expect(button).not.toHaveClass("bg-ink");
    expect(button).not.toHaveClass("motion-safe:animate-pass-steady");
  });

  it.each([
    ["at rest", null],
    ["for a city pressed in the index", PRESSED],
    ["once the wait ends without a day", { kind: "refused" } as const],
  ])("draws the arrow, not the sign, %s", (_, line) => {
    renderStart({ line, isLive: true });
    expect(signInButton()).toBeNull();
  });

  it("says a day being written takes under a minute, in the project's own words", () => {
    renderStart({ line: TYPED, isLive: true });
    expect(startStatus().textContent).toBe(
      "Writing a lively Saturday in Lisbon, with friends · under\u00A0a\u00A0minute",
    );
  });

  it("says nothing of a minute for a day Lantern opens already written", () => {
    renderStart({ line: TYPED, isLive: false });
    expect(startStatus()).toHaveTextContent(/^Opening a lively Saturday in Lisbon, with friends$/);
  });

  it("steps every plate back while its text is read and its day written, and none for a city pressed", () => {
    const view = renderStart({ line: { kind: "reading" } });
    const plates = steppedBackPlates();
    expect(plates.length).toBeGreaterThan(0);
    expect(plates.every(Boolean)).toBe(true);

    view.rerender(
      <HeldStart
        starts={STARTS}
        line={PRESSED}
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
    const { onChooseWritten } = renderStart({ line: { kind: "reading" } });
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
  it("hands the focus to the button, named Reading as the focus lands, before the text is asked for", async () => {
    const user = userEvent.setup();
    const named: string[] = [];
    let isAskedBeforeFocus = false;
    const onPlan = vi.fn(async () => undefined);
    renderStart({ onPlan });
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
    expect(isAskedBeforeFocus).toBe(false);
    expect(onPlan).toHaveBeenCalledWith("Bologna");
    // Its asking settled with no read on the line, the button is at rest again, still focused.
    await waitFor(() => expect(screen.getByRole("button", { name: "Plan this day" })).toBe(button));
    expect(button).toHaveFocus();
  });

  it("draws the sign from the press, before the line says the text is read", async () => {
    const user = userEvent.setup();
    renderStart({ onPlan: () => new Promise<void>(() => undefined) });
    await user.type(screen.getByRole("textbox"), "Bologna{Enter}");

    expect(signInButton()).not.toBeNull();
    expect(steppedBackPlates().every(Boolean)).toBe(true);
  });

  it("gives the focus back to the field when the wait ends without a day", async () => {
    const user = userEvent.setup();
    const handlers = {
      onPlan: vi.fn(() => new Promise<void>(() => undefined)),
      onChooseWritten: vi.fn(),
      onChooseReading: vi.fn(),
    };
    const startOf = (line: StartHeaderProps["line"]) => (
      <HeldStart starts={STARTS} line={line} isLive isCityFocused={false} {...handlers} />
    );
    const view = render(startOf(null));
    const field = screen.getByRole("textbox");
    await user.type(field, "Paris{Enter}");
    view.rerender(startOf({ kind: "reading" }));
    expect(screen.getByRole("button", { name: "Reading" })).toHaveFocus();

    view.rerender(startOf({ kind: "not-yet" }));
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
    const handlers = {
      onPlan: vi.fn(() => new Promise<void>(() => undefined)),
      onChooseWritten: vi.fn(),
      onChooseReading: vi.fn(),
    };
    const startOf = (line: StartHeaderProps["line"]) => (
      <HeldStart starts={STARTS} line={line} isLive isCityFocused {...handlers} />
    );
    const view = render(startOf(question));
    const field = screen.getByRole("textbox", { name: "Which city?" });
    await user.type(field, "Portland{Enter}");
    view.rerender(startOf({ kind: "reading", answering: question }));
    expect(screen.getByRole("button", { name: "Reading" })).toHaveFocus();
    // Said as the focus landed, so not again under the question.
    expect(screen.queryByText("Reading what you wrote")).not.toBeInTheDocument();

    view.rerender(
      startOf({
        ...question,
        readings: [
          { placeId: "a", name: "Portland", region: "Oregon", timezone: "America/Los_Angeles" },
          { placeId: "b", name: "Portland", region: "Maine", timezone: "America/New_York" },
        ],
      }),
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Which city?" })).toHaveFocus());
  });

  it("says Reading once, on the button the focus moves to, and Writing once, in the status", async () => {
    const user = userEvent.setup();
    const onPlan = () => new Promise<void>(() => undefined);
    const view = renderStart({ isLive: true, onPlan });
    await user.type(screen.getByRole("textbox"), "Lisbon{Enter}");
    view.rerender(
      <HeldStart
        starts={STARTS}
        line={{ kind: "reading" }}
        isLive
        isCityFocused
        onPlan={onPlan}
        onChooseWritten={vi.fn()}
        onChooseReading={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Reading" })).toHaveFocus();
    expect(heardStatus()).toBe("");
    expect(startStatus()).toHaveTextContent("Reading what you wrote");

    view.rerender(
      <HeldStart
        starts={STARTS}
        line={{ kind: "writing", request: LISBON_REQUEST, via: "typed" }}
        isLive
        isCityFocused
        onPlan={vi.fn()}
        onChooseWritten={vi.fn()}
        onChooseReading={vi.fn()}
      />,
    );
    expect(heardStatus()).toMatch(/^Writing a lively Saturday in Lisbon/);
    expect(screen.getByRole("button", { name: "Writing" })).toBeInTheDocument();
  });

  it("says Reading in the status where the press found the focus on the button already", async () => {
    const user = userEvent.setup();
    const onPlan = () => new Promise<void>(() => undefined);
    const view = renderStart({ onPlan });
    await user.type(screen.getByRole("textbox"), "Lisbon");
    const button = screen.getByRole("button", { name: "Plan this day" });
    // Tabbed to, then pressed, as a keyboard or a screen reader's own press reaches it.
    act(() => button.focus());
    await user.keyboard("{Enter}");
    view.rerender(
      <HeldStart
        starts={STARTS}
        line={{ kind: "reading" }}
        isLive={false}
        isCityFocused
        onPlan={onPlan}
        onChooseWritten={vi.fn()}
        onChooseReading={vi.fn()}
      />,
    );
    expect(button).toHaveFocus();
    expect(heardStatus()).toBe("Reading what you wrote");
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
    [{ kind: "writing", request: LISBON_REQUEST, via: "typed" } as const],
  ])("says no room left while Lantern works: %o", (line) => {
    render(
      <StartHeader
        starts={STARTS}
        line={line}
        text={textOf(MAX_INTAKE_TEXT_CHARS)}
        onTextChange={vi.fn()}
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

    expect(startStatus()).toHaveTextContent(/^Lantern has written all the days/);
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
