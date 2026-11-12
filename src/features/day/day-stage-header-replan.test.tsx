import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ELCHE_DINNER_BASIS,
  ELCHE_EATING_LATE,
  ELCHE_ITINERARY,
  ELCHE_LATE_DINNER_UNREPEATED,
  ELCHE_REQUEST,
} from "@/lib/fixtures/replan/elche-dinner";
import { KANAZAWA_START_DAY } from "@/lib/days/written/kanazawa";
import { START_REQUESTS } from "@/lib/days/written/quick-starts";
import { normalizeDay } from "@/lib/normalizer/normalize";
import { mergeShownReplan } from "@/lib/replan/merge";
import {
  ASSUMABLE_FACT_KEYS,
  type DayRequest,
  type Itinerary,
} from "@/lib/schema/itinerary.schema";
import type { PartialDay } from "@/lib/stream/outcome";
import {
  BEING_WRITTEN,
  BUSY,
  PROPOSED_BESIDE,
  THE_DAY_BEFORE,
  THE_PROPOSAL,
  YOUR_DAY_WHILE_WRITTEN,
  replanningPartOf,
} from "./not-yet";
import type { ReplanControls } from "./replan-controls";
import { sentenceFactsOf } from "./sentence";
import { ONE_CHANGE_AT_A_TIME, DayStageHeader, type HeaderSlot } from "./day-stage-header";
import { TAKE_THIS_DAY } from "./day-menu";

/** jsdom lays nothing out; the header's gliding boxes only need to be told nothing moved. */
class SilentObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => vi.stubGlobal("ResizeObserver", SilentObserver));
afterAll(() => vi.unstubAllGlobals());

const ignore = () => undefined;
/** Longer than a `gentle` spring takes to write a word over another, out and in. */
const PEN_MS = 1500;
/** How often the page draws the header again while a re-plan streams, as each partial comes. */
const PARTIAL_MS = 50;
/** How many partials the header is drawn with between the press and the landing. */
const PARTIALS = 30;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** What an ended day says Lantern assumed, as the page reads it. */
function assumptionsOf(itinerary: Itinerary): PartialDay["assumptions"] {
  return Object.fromEntries(
    ASSUMABLE_FACT_KEYS.map((key) => [
      key,
      itinerary.facts[key].source === "assumed" ? itinerary.facts[key].value : null,
    ]),
  );
}

/**
 * Production's Elche day once its dinner's re-plan has merged, with its end as the day had it,
 * as a re-plan that kept its hours leaves it: run to 23:45, production's says "out late" once
 * merged (`withAssumedEndFitted`, `src/lib/replan/merge.test.ts`), a word of its own this test
 * of the dinner's does not watch.
 */
const ELCHE_MERGED = (() => {
  const merged = mergeShownReplan({ ...ELCHE_DINNER_BASIS, replan: ELCHE_LATE_DINNER_UNREPEATED });
  if (!merged.ok) throw new Error(`Elche's re-plan merges: ${merged.reason}`);
  const facts = { ...merged.itinerary.facts, end: ELCHE_ITINERARY.facts.end };
  return { ...merged.itinerary, facts };
})();

const KANAZAWA = (() => {
  const normalized = normalizeDay(KANAZAWA_START_DAY.request, KANAZAWA_START_DAY.day);
  if (!normalized.ok) throw new Error("Kanazawa's day normalizes");
  return normalized.itinerary;
})();

interface Moment {
  request: DayRequest;
  day: Itinerary;
  replan?: Partial<ReplanControls>;
  onChoose?: (answer: { key: string; value: string }) => void;
  onCityOpenChange?: (openAt: unknown) => void;
  /** What the page says at the facts line's end: the hint, unless it says more. */
  slot?: HeaderSlot;
}

/** Elche's sentence before its dinner word, and after it. */
const BEFORE_WORD = "A balanced Thursday in Elx / Elche, on foot, early start, ";
const AFTER_WORD = " home by eleven, with family";

/** Elche's dinner, changed from early to eating late, which proposes part of its day anew. */
const ELCHE_CHANGE: ReplanControls["change"] = { word: "dinner", from: "early", to: "late" };

/** The header of a day written to its end, as `DayStage` sets it, through a re-plan. */
function headerAt({
  request,
  day,
  replan,
  onChoose = ignore,
  onCityOpenChange = ignore,
  slot = { kind: "hint" },
}: Moment) {
  const facts = sentenceFactsOf(request, assumptionsOf(day));
  const controls: ReplanControls | undefined = replan && {
    status: "idle",
    change: null,
    reach: null,
    ending: null,
    written: null,
    receipt: null,
    windows: [],
    isCompared: false,
    choose: () => false,
    compare: ignore,
    askAgain: ignore,
    ...replan,
  };
  return (
    <DayStageHeader
      request={request}
      facts={facts}
      reservedFacts={facts}
      clause={null}
      dek={day.dek}
      reservedDek={day.dek}
      isDekWriting={false}
      sunrise={null}
      sunset={null}
      isSunShown={false}
      slot={slot}
      reservedSlot={slot}
      notice={null}
      isEnabled={controls === undefined || controls.status !== "writing"}
      isWaiting={false}
      written={START_REQUESTS}
      cityOpenAt={null}
      isCityFocused={false}
      replan={controls}
      replanDay={day}
      onCityOpenChange={onCityOpenChange}
      onChooseWritten={ignore}
      onChooseCity={ignore}
      onChoose={onChoose}
      onLight={ignore}
      onRetry={ignore}
    />
  );
}

/** What an element shows: its letters, but not those standing unseen in their place. */
function seenTextOf(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(".opacity-0, .invisible")) text += node.textContent ?? "";
  }
  return text;
}

/** Every text an element's letters say as they change, from now, each once in a row. */
function watchLetters(element: Element, textOf: (element: Element) => string): () => string[] {
  const seen = [textOf(element)];
  const note = () => {
    const text = textOf(element);
    if (text !== seen.at(-1)) seen.push(text);
  };
  const observer = new MutationObserver(note);
  observer.observe(element, { subtree: true, childList: true, characterData: true });
  return () => {
    observer.takeRecords();
    note();
    return seen;
  };
}

function headline(): HTMLElement {
  return screen.getByRole("heading", { level: 1 });
}

/** The live facts line: the one not inside an unseen reserve. */
function factsLine(): HTMLElement {
  const line = [...document.querySelectorAll<HTMLElement>("header p.type-note")].find(
    (each) => each.closest("[aria-hidden]") === null,
  );
  if (!line) throw new Error("No facts line");
  return line;
}

/** The live line about the day. */
function dekLine(): HTMLElement {
  const line = [...document.querySelectorAll<HTMLElement>("header p.type-prose")].find(
    (each) => each.closest("[aria-hidden]") === null,
  );
  if (!line) throw new Error("No line about the day");
  return line;
}

describe("DayStageHeader through a word's fork", () => {
  it("changes the headline only by the pair through Elche's proposal, and no letter of the facts line", async () => {
    const view = render(headerAt({ request: ELCHE_REQUEST, day: ELCHE_ITINERARY }));
    const headlines = watchLetters(headline(), seenTextOf);
    const facts = watchLetters(factsLine(), (line) => line.textContent);
    const deks = watchLetters(dekLine(), seenTextOf);
    const writing = { status: "writing", change: ELCHE_CHANGE, reach: "part" } as const;
    // The page still says the re-plan at the facts line's end, as it has: the header keeps
    // the end it had at the press instead.
    const said: HeaderSlot = { kind: "not-yet", text: replanningPartOf("eating late", "dinner") };
    const during = { request: ELCHE_REQUEST, day: ELCHE_ITINERARY, replan: writing, slot: said };

    // The press, then the day drawn again as each partial of the proposal streams.
    view.rerender(headerAt(during));
    for (let partial = 0; partial < PARTIALS; partial += 1) {
      await wait(PARTIAL_MS);
      view.rerender(headerAt(during));
    }
    await waitFor(() =>
      expect(seenTextOf(headline())).toContain("early start, early dinner or eating late,"),
    );
    // Whole, the proposal beside the day changes no letter of the headline.
    view.rerender(
      headerAt({ ...during, replan: { ...writing, status: "proposed", isCompared: true } }),
    );
    await wait(PEN_MS);
    const proposed = headlines().length;

    // Taken: the proposal's words, the new one the visitor's, and its new line.
    view.rerender(
      headerAt({
        request: ELCHE_EATING_LATE,
        day: ELCHE_MERGED,
        replan: { status: "taken", change: ELCHE_CHANGE, reach: "part" },
      }),
    );
    await waitFor(() => expect(seenTextOf(dekLine())).toBe(ELCHE_MERGED.dek), { timeout: 8000 });
    await wait(PEN_MS);

    // The pair was written in after the visitor's word, and taken, the proposal's word stood.
    const texts = headlines();
    expect(texts.length).toBeGreaterThan(proposed);
    expect(texts[proposed - 1]).toBe(`${BEFORE_WORD}early dinner or eating late,${AFTER_WORD}`);
    expect(texts.at(-1)).toBe(`${BEFORE_WORD}eating late,${AFTER_WORD}`);
    for (const text of texts) {
      expect(text.startsWith(BEFORE_WORD) && text.endsWith(AFTER_WORD), text).toBe(true);
      // The comma keeps to the last letter written, in and out: never "early dinner ,".
      expect(text, text).not.toMatch(/\s,/);
    }
    // The facts line's end faded and came back: none of its letters was written again.
    expect(facts()).toHaveLength(1);
    // The line about the day was led as first planned while Lantern wrote, then, taken, written
    // once from its first different word.
    const lines = deks();
    expect(lines).toContain(`As first planned: ${ELCHE_ITINERARY.dek}`);
    expect(lines.at(-1)).toBe(ELCHE_MERGED.dek);
  });

  it("keeps the assumed key in the facts line when the word changed was Lantern's only assumption", async () => {
    // Every word the visitor's but the dinner, which Lantern assumed early.
    const request: DayRequest = {
      ...ELCHE_REQUEST,
      energySource: "chosen",
      travel: "on-foot",
      end: "early",
    };
    const view = render(headerAt({ request, day: ELCHE_ITINERARY }));
    const facts = watchLetters(factsLine(), (line) => line.textContent);

    view.rerender(
      headerAt({
        request,
        day: ELCHE_ITINERARY,
        replan: { status: "writing", change: ELCHE_CHANGE, reach: "part" },
      }),
    );
    await waitFor(() => expect(seenTextOf(headline())).toContain("early dinner or eating late,"));

    // The key says what the day on screen assumed, the visitor's day all the while.
    expect(facts()).toHaveLength(1);
    expect(factsLine()).toHaveTextContent("assumed by Lantern");
  });

  it("says what each answer would do under it, the current one with its check alone", async () => {
    const user = userEvent.setup();
    render(headerAt({ request: ELCHE_REQUEST, day: ELCHE_ITINERARY }));

    await user.click(within(headline()).getByRole("button", { name: "early dinner" }));

    expect(screen.getByRole("option", { name: "eating late" })).toHaveAccessibleDescription(
      "a proposal for lunch, the afternoon, dinner and the evening · about\u00A0half\u00A0a\u00A0minute",
    );
    expect(screen.getByRole("option", { name: "early dinner" })).toHaveAccessibleDescription("");
  });

  it("offers the fork's two answers alone while its proposal is written, neither changing anything", async () => {
    const user = userEvent.setup();
    const choose = vi.fn(() => true);
    const onChoose = vi.fn();
    render(
      headerAt({
        request: ELCHE_REQUEST,
        day: ELCHE_ITINERARY,
        replan: { status: "writing", change: ELCHE_CHANGE, reach: "part", choose },
        onChoose,
      }),
    );

    await user.click(within(headline()).getByRole("button", { name: "early dinner" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      expect.stringContaining("early dinner"),
      expect.stringContaining("eating late"),
    ]);
    expect(screen.getByRole("option", { name: "early dinner" })).toHaveAccessibleDescription(
      YOUR_DAY_WHILE_WRITTEN,
    );
    expect(screen.getByRole("option", { name: "eating late" })).toHaveAccessibleDescription(
      BEING_WRITTEN,
    );
    await user.click(screen.getByRole("option", { name: "eating late" }));

    expect(choose).not.toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("locks every other word, the city and the way to another day, saying one change at a time", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const onCityOpenChange = vi.fn();
    render(
      headerAt({
        request: ELCHE_REQUEST,
        day: ELCHE_ITINERARY,
        replan: { status: "writing", change: ELCHE_CHANGE, reach: "part" },
        onChoose,
        onCityOpenChange,
      }),
    );
    const status = screen.getAllByRole("status").find((each) => each.tagName === "P");
    expect(status).toHaveTextContent("re-planning lunch, the afternoon, dinner and the evening");
    const onFoot = within(headline()).getByRole("button", { name: /^on foot/ });
    expect(onFoot).toHaveAttribute("aria-disabled", "true");
    expect(onFoot).toHaveClass("text-muted");
    expect(onFoot).not.toHaveClass("hover:underline");
    // So is the date.
    expect(within(headline()).getByText("Thursday")).toHaveClass("text-muted");

    await user.click(onFoot);
    await user.click(within(headline()).getByRole("button", { name: /Elx \/ Elche/ }));
    // The way to another day, in the day menu, is locked as the words are: muted, and said so.
    await user.click(screen.getByRole("button", { name: TAKE_THIS_DAY }));
    const planAnother = screen.getByRole("menuitem", { name: /^Plan another day/ });
    expect(planAnother).toHaveAttribute("aria-disabled", "true");
    expect(within(planAnother).getByText("Plan another day")).toHaveClass("text-muted");
    await user.click(planAnother);

    expect(seenTextOf(factsLine())).toContain(ONE_CHANGE_AT_A_TIME);
    expect(status).toHaveTextContent(ONE_CHANGE_AT_A_TIME);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChoose).not.toHaveBeenCalled();
    expect(onCityOpenChange).not.toHaveBeenCalled();
  });

  it("lights the proposal's answer while it is written, and no word once it is whole", async () => {
    const view = render(
      headerAt({
        request: ELCHE_REQUEST,
        day: ELCHE_ITINERARY,
        replan: { status: "writing", change: ELCHE_CHANGE, reach: "part" },
      }),
    );
    const pair = () => within(headline()).queryByRole("button", { name: /^eating late, proposed/ });
    await waitFor(() => expect(pair()).not.toBeNull());
    // The proposal's answer alone carries the light: the visitor's own word is their day.
    expect(
      within(headline())
        .getAllByRole("button")
        .filter((button) => button.classList.contains("word-lit")),
    ).toEqual([pair()]);

    view.rerender(
      headerAt({
        request: ELCHE_REQUEST,
        day: ELCHE_ITINERARY,
        replan: { status: "proposed", change: ELCHE_CHANGE, reach: "part", isCompared: true },
      }),
    );
    expect(pair()).not.toHaveClass("word-lit");
  });

  it("takes either version from the list once the proposal is whole, from memory", async () => {
    const user = userEvent.setup();
    const choose = vi.fn(() => true);
    const onChoose = vi.fn();
    const controls = { change: ELCHE_CHANGE, reach: "part", choose } as const;
    const view = render(
      headerAt({
        request: ELCHE_REQUEST,
        day: ELCHE_ITINERARY,
        replan: { ...controls, status: "proposed", isCompared: true },
        onChoose,
      }),
    );

    await user.click(within(headline()).getByRole("button", { name: "early dinner" }));
    expect(screen.getByRole("option", { name: "eating late" })).toHaveAccessibleDescription(
      PROPOSED_BESIDE,
    );
    await user.click(screen.getByRole("option", { name: "eating late" }));
    expect(choose).toHaveBeenLastCalledWith("to");

    view.rerender(
      headerAt({
        request: ELCHE_EATING_LATE,
        day: ELCHE_MERGED,
        replan: { ...controls, status: "taken" },
        onChoose,
      }),
    );
    await user.click(within(headline()).getByRole("button", { name: "eating late" }));
    expect(screen.getByRole("option", { name: "early dinner" })).toHaveAccessibleDescription(
      THE_DAY_BEFORE,
    );
    await user.click(screen.getByRole("option", { name: "early dinner" }));
    expect(choose).toHaveBeenLastCalledWith("from");

    view.rerender(
      headerAt({
        request: ELCHE_REQUEST,
        day: ELCHE_ITINERARY,
        replan: { ...controls, status: "left" },
        onChoose,
      }),
    );
    await user.click(within(headline()).getByRole("button", { name: "early dinner" }));
    expect(screen.getByRole("option", { name: "eating late" })).toHaveAccessibleDescription(
      THE_PROPOSAL,
    );
    await user.click(screen.getByRole("option", { name: "eating late" }));
    expect(choose).toHaveBeenLastCalledWith("to");
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("writes an answer to Lantern's question as the pair after it, the question the visitor's day", async () => {
    const user = userEvent.setup();
    const change = { word: "company", from: "with anyone", to: "with family" } as const;
    const view = render(headerAt({ request: KANAZAWA_START_DAY.request, day: KANAZAWA }));
    const headlines = watchLetters(headline(), seenTextOf);

    view.rerender(
      headerAt({
        request: KANAZAWA_START_DAY.request,
        day: KANAZAWA,
        replan: { status: "writing", change, reach: "whole" },
      }),
    );
    await waitFor(() => expect(seenTextOf(headline())).toMatch(/, with anyone or with family$/));

    // The question stays: only " or with family" is written after it.
    expect(headlines().every((text) => text.includes("home by eleven, with anyone"))).toBe(true);
    await user.click(within(headline()).getByRole("button", { name: "with anyone" }));
    expect(screen.getByRole("option", { name: "with anyone" })).toHaveAccessibleDescription(
      YOUR_DAY_WHILE_WRITTEN,
    );
  });

  it("brings the hint back as a change settles after a line the facts line said, its room as at rest", () => {
    const failed: HeaderSlot = { kind: "not-yet", text: BUSY };
    const writing = { status: "writing", change: ELCHE_CHANGE, reach: "part" } as const;
    const reserves = () =>
      [...document.querySelectorAll<HTMLElement>("header [aria-hidden] p.type-note")].map(
        (line) => line.textContent,
      );
    const view = render(headerAt({ request: ELCHE_REQUEST, day: ELCHE_ITINERARY, slot: failed }));
    const atRest = reserves();

    // The press, the page saying what it re-plans: the line it had holds its room, faded.
    view.rerender(
      headerAt({
        request: ELCHE_REQUEST,
        day: ELCHE_ITINERARY,
        replan: writing,
        slot: { kind: "not-yet", text: replanningPartOf("eating late", "dinner") },
      }),
    );
    expect(reserves()).toEqual(atRest);

    // Taken, the failure is over: the hint, in its own room, as the day then rests.
    view.rerender(
      headerAt({
        request: ELCHE_EATING_LATE,
        day: ELCHE_MERGED,
        replan: { ...writing, status: "taken" },
      }),
    );
    expect(seenTextOf(factsLine())).toContain("click a word to change it");
    expect(seenTextOf(factsLine())).not.toContain("couldn't re-plan");
    const taken = reserves();
    expect(taken.join("")).not.toContain("couldn't re-plan");

    view.rerender(headerAt({ request: ELCHE_EATING_LATE, day: ELCHE_MERGED }));
    expect(reserves()).toEqual(taken);
  });

  it("stands the line about the day whole at once when the proposal is taken back and taken again", () => {
    const taken = { status: "taken", change: ELCHE_CHANGE, reach: "part" } as const;
    const view = render(headerAt({ request: ELCHE_EATING_LATE, day: ELCHE_MERGED, replan: taken }));
    expect(seenTextOf(dekLine())).toBe(ELCHE_MERGED.dek);

    view.rerender(
      headerAt({
        request: ELCHE_REQUEST,
        day: ELCHE_ITINERARY,
        replan: { ...taken, status: "left" },
      }),
    );
    expect(seenTextOf(dekLine())).toBe(ELCHE_ITINERARY.dek);

    view.rerender(headerAt({ request: ELCHE_EATING_LATE, day: ELCHE_MERGED, replan: taken }));
    expect(seenTextOf(dekLine())).toBe(ELCHE_MERGED.dek);
  });
});
