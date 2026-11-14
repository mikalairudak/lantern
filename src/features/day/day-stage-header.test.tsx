import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { cloneElement } from "react";
import userEvent from "@testing-library/user-event";
import { motionValue, type MotionValue } from "motion/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CURATED_REQUESTS, KYOTO_REQUEST, LISBON_REQUEST } from "@/lib/fixtures/curated/requests";
import { KANAZAWA_START_REQUEST, START_REQUESTS } from "@/lib/days/written/quick-starts";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import { noticeOf } from "./stream-ending";
import { requestSentenceOf, sentenceFactsOf } from "./sentence";
import { DayStageHeader, type ForkNoteShown, type HeaderNotice } from "./day-stage-header";
import type { ReplanControls } from "./replan-controls";

const ignore = () => undefined;
/** Two `gentle` springs, one in and one out, settle well within this. */
const SPRINGS_TIMEOUT = { timeout: 3000 };
/** The written days a notice offers: the starts'. */
const OFFERED_SENTENCES = START_REQUESTS.map(requestSentenceOf);

/** jsdom lays nothing out; the header's gliding box only needs to be told nothing moved. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());

/** Portland, out with friends: the visitor chose every word but the city. */
const PORTLAND: DayRequest = {
  ...LISBON_REQUEST,
  city: "Portland",
  timezone: "America/Los_Angeles",
};

interface Handlers {
  onRetry?: () => void;
  onChooseWritten?: (request: DayRequest) => void;
  /** What Lantern assumed, as far as the stream has written it; nothing by default. */
  assumptions?: PartialDay["assumptions"];
  isNoticeWrittenIn?: boolean;
  noticeOpacity?: MotionValue<number>;
  isNoticeLeaving?: boolean;
  dayOpacity?: MotionValue<number>;
  isLeaving?: boolean;
  /** The time word changed for a re-plan that streams, its new answer beside the old. */
  replan?: ReplanControls;
  onPointToFork?: () => void;
  /** Every stop shows the place the line about the day was written for. */
  isAsPlanned?: boolean;
  /** What a changed word's fork says in the facts line's place. */
  forkNote?: ForkNoteShown | null;
}

/** Kyoto's day as Lantern wrote it: every word but the company assumed, and that one asked. */
const KYOTO_ASSUMPTIONS: PartialDay["assumptions"] = {
  travel: "on-foot",
  start: "early",
  dinner: "early",
  end: "early",
  company: null,
};

/** How long a pen that writes on would take to change what it shows. */
const STILL_MS = 400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The opacity an element is drawn at, as every box round it composes it. */
function opacityOf(element: Element): number {
  let opacity = 1;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const own = node instanceof HTMLElement ? node.style.opacity : "";
    opacity *= own === "" ? 1 : Number(own);
  }
  return opacity;
}

/** The live line with these words, not one of the unseen copies that hold its room. */
function shownText(text: string | RegExp): HTMLElement {
  const shown = screen.getAllByText(text).find((each) => each.closest("[aria-hidden]") === null);
  if (!shown) throw new Error(`No shown text ${String(text)}`);
  return shown;
}

/**
 * Every text an element shows as it changes, from now: the letters seen, not those standing
 * unseen in their place, each once in a row.
 */
function watchText(element: Element): () => string[] {
  const seen = [seenTextOf(element)];
  const observer = new MutationObserver(() => {
    const text = seenTextOf(element);
    if (text !== seen.at(-1)) seen.push(text);
  });
  observer.observe(element, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  return () => {
    observer.takeRecords();
    const text = seenTextOf(element);
    if (text !== seen.at(-1)) seen.push(text);
    return seen;
  };
}

/** The notice's line on screen, under the headline. */
function noticeLine(): HTMLElement {
  const line = document.querySelector<HTMLElement>("header p.text-quote");
  if (!line) throw new Error("No notice line");
  return line;
}

/** What a line shows: its letters, but not those standing unseen in their place. */
function seenTextOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(".opacity-0, .invisible")) text += node.textContent ?? "";
  }
  return text;
}

/** The header of a day whose model has assumed nothing, so only the city can be Lantern's. */
function renderHeader(...args: Parameters<typeof headerOf>) {
  return render(headerOf(...args));
}

function headerOf(
  request: DayRequest,
  clause: string | null = null,
  notice: HeaderNotice | null = null,
  {
    onRetry = ignore,
    onChooseWritten = ignore,
    assumptions = {},
    isNoticeWrittenIn,
    noticeOpacity,
    isNoticeLeaving,
    dayOpacity,
    isLeaving,
    replan,
    onPointToFork,
    isAsPlanned,
    forkNote = null,
  }: Handlers = {},
) {
  const facts = sentenceFactsOf(request, assumptions);
  return (
    <DayStageHeader
      request={request}
      facts={facts}
      reservedFacts={facts}
      clause={clause}
      dek="Food carts at noon, the river at dusk."
      reservedDek="Food carts at noon, the river at dusk."
      isDekWriting={false}
      isAsPlanned={isAsPlanned}
      sunrise={null}
      sunset={null}
      isSunShown={false}
      slot={null}
      reservedSlot={null}
      notice={notice}
      isNoticeWrittenIn={isNoticeWrittenIn}
      noticeOpacity={noticeOpacity}
      isNoticeLeaving={isNoticeLeaving}
      dayOpacity={dayOpacity}
      isLeaving={isLeaving}
      replan={replan}
      onPointToFork={onPointToFork}
      forkNote={forkNote}
      isEnabled
      isWaiting={false}
      written={CURATED_REQUESTS}
      cityOpenAt={null}
      isCityFocused={false}
      onCityOpenChange={ignore}
      onChooseWritten={onChooseWritten}
      onChooseCity={ignore}
      onChoose={ignore}
      onLight={ignore}
      onRetry={onRetry}
    />
  );
}

/** Kyoto's start changed to a slow morning, its fork at a step, as the page tells the header. */
function slowMorning(step: Partial<ReplanControls>): ReplanControls {
  return {
    status: "idle",
    change: { word: "start", from: "early start", to: "slow morning" },
    reach: "part",
    ending: null,
    written: null,
    receipt: null,
    windows: [],
    isCompared: false,
    choose: () => false,
    compare: ignore,
    askAgain: ignore,
    ...step,
  };
}

/** The header's own live line; the day menu beside it holds one of its own, for a copied link. */
function headerStatus(): HTMLElement {
  const status = screen.getAllByRole("status").find((each) => each.tagName === "P");
  if (!status) throw new Error("The header has no live line");
  return status;
}

describe("DayStageHeader", () => {
  it("keeps a fork note's dot with its press, so a note that wraps never ends a line on the dot", async () => {
    const onPress = vi.fn();
    renderHeader(PORTLAND, null, null, {
      forkNote: {
        words: "Writing “eating late” for dinner and the evening",
        link: { label: "see it at\u00A017:30", onPress },
      },
    });

    const press = screen.getByRole("button", { name: "see it at\u00A017:30" });
    const bound = press.parentElement as HTMLElement;
    // The dot and the press stand in one span that never breaks, a space before it only.
    expect(bound).toHaveClass("whitespace-nowrap");
    expect(bound.textContent).toBe("·\u00A0see it at\u00A017:30");
    expect(bound.closest("p")?.textContent).toBe(
      "Writing “eating late” for dinner and the evening ·\u00A0see it at\u00A017:30",
    );
    await userEvent.setup().click(press);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("keys a city Lantern assumed, as it keys its other assumptions", () => {
    renderHeader({ ...PORTLAND, citySource: "assumed" });

    const city = within(screen.getByRole("heading", { level: 1 })).getByRole("button", {
      name: "Portland",
    });
    expect(city).toHaveClass("decoration-dotted");
    // Shown, and held in the unseen copies that keep the facts line's and the header's height.
    expect(screen.getAllByText("assumed")).toHaveLength(3);
  });

  it("holds room for the longest clause the curve could say of any day", () => {
    renderHeader(PORTLAND);

    expect(
      screen.getAllByText("quieter in the morning and livelier in the afternoon").length,
    ).toBeGreaterThan(0);
  });

  // A laptop's Porto, home by eight, takes its longest clause a line further for "balanced"
  // than for "calm".
  it("holds on a laptop the longest clause's room for the widest energy word, so a re-pick never moves the chart", () => {
    renderHeader(PORTLAND);

    const rooms = screen
      .getAllByText("quieter in the morning and livelier in the afternoon")
      .map((clause) => clause.closest("p"));
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.querySelector("span")?.textContent).toBe("balanced");
    expect(rooms[0]).toHaveClass("@max-measure:hidden");
  });

  it("holds the longest clause's room and the lead's on a laptop only: a phone takes them as they come", () => {
    renderHeader(PORTLAND);

    // jsdom has no container queries: the room a phone leaves out says so in its classes.
    const longest = screen.getAllByText("quieter in the morning and livelier in the afternoon");
    for (const clause of longest) expect(clause.closest("p")).toHaveClass("@max-measure:hidden");
    // Of the copies that hold its room: one measures the line with its lead, holding none.
    const leads = screen
      .getAllByText("As first planned:")
      .filter((lead) => lead.closest(".h-0") === null);
    expect(leads.length).toBeGreaterThan(0);
    for (const lead of leads) expect(lead).toHaveClass("@max-measure:hidden");
    cleanup();
    // Once a stop shows another place, the lead's room is held on a phone too, so its line
    // opens before the pen writes into it.
    renderHeader(PORTLAND, null, null, { isAsPlanned: false });
    const held = screen
      .getAllByText("As first planned:")
      .filter((lead) => lead.closest("[aria-hidden]") !== null && lead.closest(".h-0") === null);
    expect(held.length).toBeGreaterThan(0);
    for (const lead of held) expect(lead).not.toHaveClass("@max-measure:hidden");
    // The sentence's own room, without a clause, is held at every width.
    const sentences = document.querySelectorAll("header p[aria-hidden].invisible");
    expect([...sentences].some((shape) => !shape.className.includes("@max-measure:hidden"))).toBe(
      true,
    );
  });

  it("sets the line about the day a size down on a phone, in the quote's size", () => {
    renderHeader(PORTLAND);

    const line = shownText("Food carts at noon, the river at dusk.");
    expect(line).toHaveClass("text-dek", "@max-measure:text-quote");
    expect(line.closest(".\\@container")).not.toBeNull();
  });

  it("holds each line's room under the line itself, as it arrives", () => {
    renderHeader(PORTLAND);

    // The line about the day is written once, and held twice unseen: by its own line, and
    // by the whole header's reserve, each with the room its lead after a swap takes. Two more
    // copies, holding no room, measure whether its lead fits its lines on a phone.
    const lines = screen
      .getAllByText(/Food carts at noon, the river at dusk\.$/)
      .filter((line) => line.closest(".h-0") === null);
    expect(lines).toHaveLength(3);
    const held = lines.filter((line) => line.closest("[aria-hidden]") !== null);
    expect(held.map((line) => line.textContent)).toEqual([
      "As first planned: Food carts at noon, the river at dusk.",
      "As first planned: Food carts at noon, the river at dusk.",
    ]);
  });

  it("says the line about the day as it was written while the day on show is the planned one", () => {
    renderHeader(PORTLAND);

    const line = shownText("Food carts at noon, the river at dusk.");
    expect(line).toHaveClass("text-ink-soft");
    expect(line).not.toHaveTextContent("As first planned");
  });

  it("never leaves the lead alone while the line is written again", async () => {
    const { rerender } = renderHeader(PORTLAND, null, null, { isAsPlanned: false });
    expect(shownText(/^As first planned:/)).toBeInTheDocument();

    // A re-plan unwrites the line and writes the next: the lead goes with the line at once.
    const next = "Coffee by the river, then the bridges at dusk.";
    rerender(
      cloneElement(headerOf(PORTLAND, null, null, { isAsPlanned: false }), {
        dek: next,
        reservedDek: next,
      }),
    );
    const isLeadSeen = () =>
      screen
        .queryAllByText("As first planned:")
        .some((lead) => lead.closest("[aria-hidden]") === null);
    expect(isLeadSeen()).toBe(false);
    // Once the new line is whole, a day still unlike its plan says so again.
    await waitFor(() => expect(isLeadSeen()).toBe(true), SPRINGS_TIMEOUT);
  });

  it("brings the lead in, from part-way faded, once a swap makes the day unlike its plan", async () => {
    const { rerender } = renderHeader(PORTLAND);
    const leadShown = () =>
      screen
        .queryAllByText("As first planned:")
        .find((lead) => lead.closest("[aria-hidden]") === null);
    expect(leadShown()).toBeUndefined();

    rerender(headerOf(PORTLAND, null, null, { isAsPlanned: false }));

    // The page's own words come in whole, never stand at once from none.
    await waitFor(() => expect(leadShown()).toBeDefined());
    const fade = leadShown()?.closest('span[style*="opacity"]');
    expect(fade).not.toBeNull();
    expect(fade?.closest("p")).toHaveTextContent(/^As first planned: Food carts at noon/);
  });

  it("brings the facts line's first line in, its separator with it, from part-way faded", () => {
    const kept = "Lantern isn't re-planning days right now, so dinner stays as written";
    const { rerender } = renderHeader(PORTLAND);

    rerender(cloneElement(headerOf(PORTLAND), { slot: { kind: "not-yet", text: kept } }));

    const said = screen
      .getAllByText(kept)
      .find((line) => line.closest("[aria-hidden], .sr-only, .invisible") === null);
    const fade = said?.closest('span[style*="opacity"]');
    expect(fade).toHaveStyle({ opacity: "0.3" });
    const fades = fade?.closest('[role="status"]')?.querySelectorAll('span[style*="opacity"]');
    expect([...(fades ?? [])].map((each) => each.textContent)).toEqual([" · ", kept]);
  });

  it("brings each next line of the facts line in under the separator that stays", async () => {
    const first = "Lantern isn't re-planning days right now, so dinner stays as written";
    const next = "Lantern isn't re-planning days right now, so the day stays as written";
    const header = headerOf(PORTLAND);
    const { rerender } = render(cloneElement(header, { slot: { kind: "not-yet", text: first } }));

    rerender(cloneElement(header, { slot: { kind: "not-yet", text: next } }));

    const said = screen
      .getAllByText(next)
      .find((line) => line.closest("[aria-hidden], .sr-only, .invisible") === null);
    const status = said?.closest('[role="status"]');
    expect(said?.closest('span[style*="opacity"]')).toHaveStyle({ opacity: "0.3" });
    // The separator stood through the change, drawn as it is.
    const separator = [...(status?.querySelectorAll('span[style*="opacity"]') ?? [])].find(
      (each) => each.textContent === " · ",
    );
    expect(separator ?? null).toBeNull();
    expect(status).toHaveTextContent(`· ${next}`);
  });

  it("says it is the day as first planned, in the quiet ink, once a stop shows another place", () => {
    renderHeader(PORTLAND, null, null, { isAsPlanned: false });

    const line = shownText(/Food carts at noon, the river at dusk\.$/);
    expect(line).toHaveTextContent(/^As first planned: Food carts at noon/);
    expect(line).toHaveClass("text-muted");
    expect(line).not.toHaveClass("text-ink-soft");
    // The product's words, upright before the model's italic line.
    expect(within(line).getByText("As first planned:").closest(".not-italic")).not.toBeNull();
  });

  it("holds the clause it shows under the sentence itself, so its line opens first", () => {
    renderHeader(PORTLAND, "livelier at lunch");

    // Written in the headline, and held unseen by the sentence's own row, in full.
    const clauses = screen.getAllByText("livelier at lunch");
    expect(clauses).toHaveLength(2);
    expect(clauses.filter((clause) => clause.closest("[aria-hidden]") === null)).toHaveLength(1);
  });

  it("lets a clause go with the curve when it opened no line of its own", async () => {
    const view = renderHeader(PORTLAND, null, null);
    const headline = screen.getByRole("heading", { level: 1 });
    const seen: string[] = [];
    const watch = new MutationObserver(() => seen.push(headline.textContent ?? ""));
    watch.observe(headline, { subtree: true, characterData: true, childList: true });

    // Set and let go at once: no row glides here, so no line opened for it, and it is
    // owed nothing, as on a laptop where the clause fits the sentence's line.
    view.rerender(headerOf(PORTLAND, "livelier at lunch", null));
    view.rerender(headerOf(PORTLAND, null, null));

    await waitFor(() => expect(headline).not.toHaveTextContent("livelier"), SPRINGS_TIMEOUT);
    watch.disconnect();
    expect(seen.some((text) => text.includes(", livelier at lunch,"))).toBe(false);
  });

  it("dots none of Lantern's words under a notice, as no day was planned on them", () => {
    const assumed: DayRequest = { ...PORTLAND, citySource: "assumed" };
    renderHeader(assumed, null, noticeOf({ kind: "unavailable" }, assumed));

    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline.querySelector(".decoration-dotted")).toBeNull();
    expect(within(headline).getByRole("button", { name: "Portland" })).not.toHaveClass(
      "decoration-dotted",
    );
    expect(screen.queryByText("assumed")).not.toBeInTheDocument();
  });

  it("says nothing was assumed when the visitor chose the city too", () => {
    renderHeader({ ...PORTLAND, citySource: "chosen" });

    expect(screen.queryByText("assumed")).not.toBeInTheDocument();
  });

  it("says a day it could not finish in place of the line about the day, with the way on", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onChooseWritten = vi.fn();
    const notice = noticeOf({ kind: "cut", itinerary: null }, KYOTO_REQUEST);
    renderHeader(KYOTO_REQUEST, null, notice, { onRetry, onChooseWritten });

    expect(noticeLine()).toHaveTextContent(
      /^Lantern couldn't finish this day\. Write it again, or open one it has written:$/,
    );
    expect(screen.queryByText("Food carts at noon, the river at dusk.")).not.toBeInTheDocument();
    expect(screen.queryByText("Sat 14 Nov")).not.toBeInTheDocument();
    // The starts' days are offered; Kyoto's, written by hand, never is.
    const offered = within(screen.getByRole("list")).getAllByRole("button");
    expect(offered.map((button) => button.textContent)).toEqual(OFFERED_SENTENCES);

    const retry = within(noticeLine()).getByRole("button", { name: "Write it again" });
    // Its comma is inside it, unheard, so the comma never opens a line of its own.
    expect(retry).toHaveTextContent(/^Write it again,$/);
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
    await user.click(offered[0]!);
    expect(onChooseWritten).toHaveBeenCalledWith(START_REQUESTS[0]);
  });

  it("says a notice set from its first frame whole, as a still does", () => {
    renderHeader(KYOTO_REQUEST, null, noticeOf({ kind: "cut", itinerary: null }, KYOTO_REQUEST));

    expect(seenTextOf(noticeLine())).toBe(
      "Lantern couldn't finish this day. Write it again, or open one it has\u00A0written:",
    );
    expect(document.querySelector("header .opacity-0:not([data-theme-helper])")).toBeNull();
    expect(document.querySelector("header [inert]")).toBeNull();
  });

  it("writes a notice that takes the day's place in, its line heard once and whole", async () => {
    const notice = noticeOf({ kind: "cut", itinerary: null }, KYOTO_REQUEST);
    renderHeader(KYOTO_REQUEST, null, notice, { isNoticeWrittenIn: true });
    const line = noticeLine();
    const status = headerStatus();
    const heard: string[] = [];
    const listen = new MutationObserver(() => heard.push(status.textContent ?? ""));
    listen.observe(status, { subtree: true, characterData: true, childList: true });

    // Its room stands from before its first letter, out of reach until the pen has written
    // it, while a screen reader is told its whole line by a status of its own.
    expect(seenTextOf(line)).toBe("");
    expect(line).not.toHaveAttribute("role");
    expect(status).toHaveClass("sr-only");
    expect(status).toHaveTextContent(
      /^Lantern couldn't finish this day\. Write it again, or open one it has written:$/,
    );
    expect(line.closest("[inert]")).not.toBeNull();

    // Lantern's own words, so no pen writes them: they come whole.
    await waitFor(
      () => expect(seenTextOf(line)).toMatch(/^Lantern couldn't finish this day\./),
      SPRINGS_TIMEOUT,
    );
    await waitFor(
      () => expect(document.querySelector("header .opacity-0:not([data-theme-helper])")).toBeNull(),
      SPRINGS_TIMEOUT,
    );
    expect(seenTextOf(screen.getByRole("list"))).toBe(OFFERED_SENTENCES.join(""));
    expect(line.closest("[inert]")).toBeNull();
    // Once the page says the line, the status says it no more, so it is heard once.
    await waitFor(() => expect(status.textContent).toBe(""));
    listen.disconnect();
    // The status only ever fell quiet, never a fragment.
    expect(heard.length).toBeGreaterThan(0);
    expect(heard.every((text) => text === "")).toBe(true);
  });

  it("fades a notice that leaves for the next day as it stands, the focus on the control pressed", async () => {
    const notice = noticeOf({ kind: "cut", itinerary: null }, KYOTO_REQUEST);
    const view = renderHeader(KYOTO_REQUEST, null, notice, { isNoticeWrittenIn: true });
    // Written whole, so its controls are in reach.
    await waitFor(() => expect(noticeLine().closest("[inert]")).toBeNull(), SPRINGS_TIMEOUT);
    const retry = screen.getByRole("button", { name: "Write it again" });
    retry.focus();

    const noticeOpacity = motionValue(0.5);
    view.rerender(
      headerOf(KYOTO_REQUEST, null, notice, {
        isNoticeWrittenIn: true,
        noticeOpacity,
        isNoticeLeaving: true,
      }),
    );
    const still = seenTextOf(noticeLine());
    await wait(STILL_MS);

    // Whole and still, at the notice's opacity, out of the hand's reach; the headline stays
    // whole. The focus stays on the control pressed, which fades with it: inert, the notice
    // would drop the focus off the page.
    expect(seenTextOf(noticeLine())).toBe(still);
    expect(opacityOf(noticeLine())).toBe(0.5);
    expect(opacityOf(screen.getByRole("list"))).toBe(0.5);
    expect(noticeLine().closest(".pointer-events-none")).not.toBeNull();
    expect(noticeLine().closest("[inert]")).toBeNull();
    const headline = screen.getByRole("heading", { level: 1 });
    expect(opacityOf(headline)).toBe(1);
    expect(retry).toHaveFocus();
  });

  it("fades the day's lines and Lantern's words with their commas on the day's opacity", () => {
    const dayOpacity = motionValue(0.5);
    const assumptions = { ...KYOTO_ASSUMPTIONS, company: undefined };
    renderHeader(LISBON_REQUEST, null, null, { assumptions, dayOpacity, isLeaving: true });
    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveTextContent(
      /^A lively Saturday in Lisbon, on foot, early start, early dinner, home by eleven, with friends$/,
    );

    // Lantern's words leave, each with its comma; the visitor's stay, and so does the comma
    // after Lisbon, which "with friends" still follows.
    for (const word of ["on foot", "early start", "early dinner", "home by eleven"]) {
      expect(opacityOf(within(headline).getByRole("button", { name: word }))).toBe(0.5);
    }
    for (const word of ["lively", "Lisbon", "with friends"]) {
      expect(opacityOf(within(headline).getByRole("button", { name: word }))).toBe(1);
    }
    const city = headline.querySelector("[data-word=city]");
    expect(city).toHaveTextContent(/^Lisbon,$/);
    expect(opacityOf(within(city as HTMLElement).getByText(","))).toBe(1);
    expect(opacityOf(shownText("Food carts at noon, the river at dusk."))).toBe(0.5);
    expect(opacityOf(shownText(/^Sat 14 Nov/))).toBe(0.5);
  });

  it("fades the comma after the city when only Lantern's words followed it", () => {
    const dayOpacity = motionValue(0.5);
    renderHeader(KYOTO_REQUEST, null, null, {
      assumptions: KYOTO_ASSUMPTIONS,
      dayOpacity,
      isLeaving: true,
    });

    const city = document.querySelector<HTMLElement>("h1 [data-word=city]");
    expect(city).toHaveTextContent(/^Kyoto,$/);
    expect(opacityOf(within(city!).getByText(","))).toBe(0.5);
    expect(opacityOf(within(city!).getByRole("button", { name: "Kyoto" }))).toBe(1);
  });

  // A pen stopped mid-sentence is caught on a frozen clock: day-stage-header-pen.test.tsx.

  it("holds the room of Lantern's words the pen has not reached, and of the visitor's after them", () => {
    // The visitor asked for a slow morning; Lantern's "on foot" comes before it.
    const request: DayRequest = { ...KYOTO_REQUEST, start: "slow" };
    const header = headerOf(request, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const known = header.props.reservedFacts as ReturnType<typeof sentenceFactsOf>;
    // Every word known, none of Lantern's reached by the pen yet.
    const held = Object.fromEntries(
      Object.entries(known).map(([key, fact]) => [key, fact?.source === "chosen" ? fact : null]),
    );
    render(cloneElement(header, { facts: held, isFromStart: true }));
    const headline = screen.getByRole("heading", { level: 1 });

    // Not written, so neither seen nor a word to press, but laid out where it will be
    // written, with its comma; and the visitor's "slow morning" after it waits in its room
    // too, so the sentence shows no word with a gap before it.
    expect(within(headline).queryByRole("button", { name: /on foot|slow morning/ })).toBeNull();
    expect(seenTextOf(headline)).not.toMatch(/on foot|slow morning|early dinner/);
    // Nothing after the city is shown yet, so neither is its comma: it comes with "on foot".
    expect(seenTextOf(headline).trimEnd()).toMatch(/Kyoto$/);
    const text = headline.textContent ?? "";
    expect(text).toContain("on foot,");
    expect(text).toContain("slow morning,");
    expect(text).toContain("early dinner,");
    expect(text.indexOf("on foot,")).toBeLessThan(text.indexOf("slow morning"));
  });

  it("writes the sentence in its order as the pen reaches Lantern's words, the visitor's shown whole", async () => {
    const request: DayRequest = { ...KYOTO_REQUEST, start: "slow" };
    const header = headerOf(request, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const known = header.props.reservedFacts as ReturnType<typeof sentenceFactsOf>;
    const visitors = Object.fromEntries(
      Object.entries(known).map(([key, fact]) => [key, fact?.source === "chosen" ? fact : null]),
    );
    const view = render(cloneElement(header, { facts: visitors, isFromStart: true }));
    const headline = screen.getByRole("heading", { level: 1 });

    // The pen reaches "on foot": once it is written whole, "slow morning" stands after it.
    view.rerender(cloneElement(header, { facts: { ...visitors, travel: known.travel } }));
    // Its comma comes with the word after it.
    await waitFor(() => expect(seenTextOf(headline)).toContain("on foot, slow morning"));
    expect(seenTextOf(headline)).not.toContain("early dinner");
    // Every frame on the way showed a start of the sentence: nothing after a gap.
    const whole = headline.textContent?.replace(/\s+/g, " ") ?? "";
    expect(whole.startsWith(seenTextOf(headline).replace(/\s+/g, " ").trimEnd())).toBe(true);
  });

  it("shows a word changed once the sentence has stood whole at once, never written in", async () => {
    const request: DayRequest = { ...KYOTO_REQUEST, start: "slow" };
    const header = headerOf(request, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const known = header.props.reservedFacts as ReturnType<typeof sentenceFactsOf>;
    const visitors = Object.fromEntries(
      Object.entries(known).map(([key, fact]) => [key, fact?.source === "chosen" ? fact : null]),
    );
    const view = render(cloneElement(header, { facts: visitors, isFromStart: true }));
    const headline = screen.getByRole("heading", { level: 1 });
    view.rerender(header);
    await waitFor(() => expect(seenTextOf(headline)).toMatch(/early dinner, home by/));
    await waitFor(() => expect(seenTextOf(headline)).toBe(headline.textContent));

    // The visitor changes their morning: a word the page knows comes in whole, in the frame
    // it changes, and the pen writes none of it.
    const changed = headerOf({ ...request, start: "early" }, null, null, {
      assumptions: KYOTO_ASSUMPTIONS,
    });
    view.rerender(changed);
    expect(seenTextOf(headline)).toContain("early start");
    expect(seenTextOf(headline)).toBe(headline.textContent);
  });

  it("tells the day while it writes the sentence in its order, so the line about the day waits", async () => {
    const request: DayRequest = { ...KYOTO_REQUEST, start: "slow" };
    const header = headerOf(request, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const known = header.props.reservedFacts as ReturnType<typeof sentenceFactsOf>;
    const visitors = Object.fromEntries(
      Object.entries(known).map(([key, fact]) => [key, fact?.source === "chosen" ? fact : null]),
    );
    const told: boolean[] = [];
    const onWrittenInOrder = (isInOrder: boolean) => told.push(isInOrder);
    const view = render(
      cloneElement(header, { facts: visitors, isFromStart: true, onWrittenInOrder }),
    );
    expect(told).toEqual([true]);

    view.rerender(cloneElement(header, { onWrittenInOrder }));
    const headline = screen.getByRole("heading", { level: 1 });
    await waitFor(() => expect(seenTextOf(headline)).toBe(headline.textContent));
    // Told once more, as the sentence stands whole: from then the line about the day is written.
    await waitFor(() => expect(told).toEqual([true, false]));
  });

  it("keeps the pen's beat on a day not taken from the start screen, as a kept day's link", () => {
    const request: DayRequest = { ...KYOTO_REQUEST, start: "slow" };
    const header = headerOf(request, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const known = header.props.reservedFacts as ReturnType<typeof sentenceFactsOf>;
    const visitors = Object.fromEntries(
      Object.entries(known).map(([key, fact]) => [key, fact?.source === "chosen" ? fact : null]),
    );
    const told: boolean[] = [];
    const onWrittenInOrder = (isInOrder: boolean) => told.push(isInOrder);

    render(cloneElement(header, { facts: visitors, onWrittenInOrder }));

    // The visitor's "slow morning" stands from the first frame, Lantern's "on foot" still to
    // be written before it, and the line about the day keeps the pen's beat.
    expect(seenTextOf(screen.getByRole("heading", { level: 1 }))).toContain("slow morning");
    expect(told).toEqual([false]);
  });

  it("brings the city's comma with the first letter of the word after it, never before", async () => {
    // A day's own address: Lantern's words arrive after the sentence is drawn.
    const header = headerOf(KYOTO_REQUEST, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const known = header.props.reservedFacts as ReturnType<typeof sentenceFactsOf>;
    const visitors = Object.fromEntries(
      Object.entries(known).map(([key, fact]) => [key, fact?.source === "chosen" ? fact : null]),
    );
    const view = render(cloneElement(header, { facts: visitors, reservedFacts: visitors }));
    const headline = screen.getByRole("heading", { level: 1 });

    // "on foot" comes: until its pen writes its first letter, the city stands without a comma.
    view.rerender(
      cloneElement(header, { facts: { ...visitors, travel: known.travel }, reservedFacts: known }),
    );
    expect(seenTextOf(headline).trimEnd()).toMatch(/Kyoto$/);
    await waitFor(() => expect(seenTextOf(headline)).toMatch(/Kyoto, o/));
  });

  it("hides no word shown for one of Lantern's that comes after the sentence is drawn", () => {
    const request: DayRequest = { ...KYOTO_REQUEST, start: "slow" };
    const header = headerOf(request, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const known = header.props.reservedFacts as ReturnType<typeof sentenceFactsOf>;
    const visitors = Object.fromEntries(
      Object.entries(known).map(([key, fact]) => [key, fact?.source === "chosen" ? fact : null]),
    );
    // Drawn with "on foot" still to come, as a start screen that turned at its cap can be.
    const view = render(
      cloneElement(header, {
        facts: visitors,
        reservedFacts: { ...known, travel: null },
        isFromStart: true,
      }),
    );
    const headline = screen.getByRole("heading", { level: 1 });
    expect(seenTextOf(headline)).toContain("slow morning");

    // It comes: it takes its room as it is written, and "slow morning" stays shown.
    view.rerender(
      cloneElement(header, { facts: { ...visitors, travel: known.travel }, reservedFacts: known }),
    );
    expect(seenTextOf(headline)).toContain("slow morning");
  });

  it("lets Lantern's words that arrive after the sentence is drawn take their room as written", () => {
    // A day's own address: the visitor's words first, Lantern's as the stream brings them.
    const request: DayRequest = { ...KYOTO_REQUEST, start: "slow" };
    const header = headerOf(request, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const known = header.props.reservedFacts as ReturnType<typeof sentenceFactsOf>;
    const visitors = Object.fromEntries(
      Object.entries(known).map(([key, fact]) => [key, fact?.source === "chosen" ? fact : null]),
    );
    const view = render(cloneElement(header, { facts: visitors, reservedFacts: visitors }));
    const headline = screen.getByRole("heading", { level: 1 });

    // Known now, but not when the sentence was drawn: its room would open under the
    // visitor's words at once, ahead of the header's glide, so none is held.
    view.rerender(cloneElement(header, { facts: visitors, reservedFacts: known }));
    expect(seenTextOf(headline)).toBe(headline.textContent);
  });

  it("says the fork's pair after the visitor's word while its proposal is drawn, and lets it go once one is chosen", async () => {
    const view = renderHeader(KYOTO_REQUEST, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const headline = screen.getByRole("heading", { level: 1 });
    const seen = watchText(headline);

    view.rerender(
      headerOf(KYOTO_REQUEST, null, null, {
        assumptions: KYOTO_ASSUMPTIONS,
        replan: slowMorning({ status: "writing" }),
      }),
    );
    await waitFor(() =>
      expect(seenTextOf(headline)).toContain("on foot, early start or slow morning, early dinner"),
    );
    // The visitor's word stays theirs; the proposal's answer is blue, lit while it is written.
    const pair = within(headline).getByRole("button", { name: /^slow morning, proposed/ });
    expect(pair).toHaveClass("text-swap");
    expect(headline.querySelector("del")).toBeNull();
    // Only the pair was written in: every line on the way says the rest as it was.
    expect(
      seen().every((text) => text.startsWith("A calm Saturday in Kyoto, on foot, early start")),
    ).toBe(true);

    // Left, the pen takes the pair away again, the visitor's word as it was.
    view.rerender(
      headerOf(KYOTO_REQUEST, null, null, {
        assumptions: KYOTO_ASSUMPTIONS,
        replan: slowMorning({ status: "left" }),
      }),
    );
    await waitFor(() =>
      expect(seenTextOf(headline)).toBe(
        "A calm Saturday in Kyoto, on foot, early start, early dinner, home by eleven, with anyone",
      ),
    );
  });

  it("points to the fork from the pair's answer", async () => {
    const onPointToFork = vi.fn();
    renderHeader(KYOTO_REQUEST, null, null, {
      assumptions: KYOTO_ASSUMPTIONS,
      replan: slowMorning({ status: "proposed", isCompared: true }),
      onPointToFork,
    });
    const headline = screen.getByRole("heading", { level: 1 });

    const pair = await within(headline).findByRole("button", { name: /^slow morning, proposed/ });
    pair.click();
    expect(onPointToFork).toHaveBeenCalledOnce();
  });

  it("says the proposal's answer alone once it is taken, compared beside it the day before's", async () => {
    const taken = { ...KYOTO_REQUEST, start: "slow" as const };
    const view = renderHeader(taken, null, null, {
      assumptions: { ...KYOTO_ASSUMPTIONS, start: "slow" },
      replan: slowMorning({ status: "taken" }),
    });
    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveTextContent("on foot, slow morning, early dinner");
    expect(within(headline).queryByRole("button", { name: /proposed/ })).toBeNull();

    view.rerender(
      headerOf(taken, null, null, {
        assumptions: { ...KYOTO_ASSUMPTIONS, start: "slow" },
        replan: slowMorning({ status: "taken", isCompared: true }),
      }),
    );
    await waitFor(() =>
      expect(seenTextOf(headline)).toContain("slow morning or early start, early dinner"),
    );
  });

  it("lets Lantern's words go in one step when a notice takes the day's place", () => {
    const notice = noticeOf({ kind: "cut", itinerary: null }, KYOTO_REQUEST);
    const view = renderHeader(KYOTO_REQUEST, null, null, { assumptions: KYOTO_ASSUMPTIONS });
    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveTextContent(
      "A calm Saturday in Kyoto, on foot, early start, early dinner, home by eleven, with anyone",
    );

    view.rerender(
      headerOf(KYOTO_REQUEST, null, notice, {
        assumptions: undefined,
        isNoticeWrittenIn: true,
      }),
    );

    // Not unwritten a letter at a time: the visitor's words stand alone at once.
    expect(headline).toHaveTextContent(/^A calm Saturday in Kyoto$/);
  });

  it("ties the last two words of the way on, so the last never stands alone", () => {
    renderHeader(KYOTO_REQUEST, null, noticeOf({ kind: "refused" }, KYOTO_REQUEST));

    expect(noticeLine().textContent).toMatch(/has\u00A0written:$/);
  });

  it("offers no retry for a day Lantern will not plan", () => {
    renderHeader(KYOTO_REQUEST, null, noticeOf({ kind: "refused" }, KYOTO_REQUEST));

    expect(headerStatus()).toHaveTextContent(
      /^Lantern can't plan this day\. Open one it has written:$/,
    );
    expect(screen.queryByRole("button", { name: "Write it again" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(
      START_REQUESTS.length,
    );
  });

  it("offers only the retry for a written day that did not come", () => {
    renderHeader(
      KANAZAWA_START_REQUEST,
      null,
      noticeOf({ kind: "unavailable" }, KANAZAWA_START_REQUEST),
    );

    // With nothing after it, the retry has no comma.
    expect(screen.getByRole("button", { name: "Write it again" })).toHaveTextContent(
      /^Write it again$/,
    );

    expect(headerStatus()).toHaveTextContent(
      /^Lantern couldn't write this day just now\. Write it again$/,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
