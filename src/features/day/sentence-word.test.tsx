import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FACT_OPTIONS } from "./facts";
import { SentenceWord, type WordReplanning, type WordView } from "./sentence-word";

const BY_TRANSIT: WordView = {
  key: "travel",
  label: "by public transport",
  source: "assumed",
  struck: null,
  options: [],
  listLabel: "How you get around",
};

const ignore = () => undefined;

/** Long enough for a word's `gentle` spring to have written it whole. */
const WRITTEN_MS = 1500;
const STILL_MS = 400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sentenceWith(view: WordView, isHeld = false, isStill = false) {
  return (
    <p>
      in Lisbon,
      <SentenceWord
        view={view}
        lead=" "
        trail=","
        isHeld={isHeld}
        isStill={isStill}
        isEnabled={false}
        onChoose={ignore}
        onLight={ignore}
      />{" "}
      with friends
    </p>
  );
}

function renderWord(isHeld: boolean) {
  return render(sentenceWith(BY_TRANSIT, isHeld));
}

describe("SentenceWord", () => {
  it("keeps its comma back until its first letter is written", () => {
    const { container } = renderWord(true);

    // The comma before it stands alone: two would meet.
    expect(container).toHaveTextContent(/^in Lisbon, with friends$/);
  });

  it("takes its comma with it once written", () => {
    const { container } = renderWord(false);

    expect(container).toHaveTextContent(/^in Lisbon, by public transport, with friends$/);
  });

  it("keeps its comma with the words a revision struck, while the new word starts", () => {
    const { container, rerender } = render(sentenceWith({ ...BY_TRANSIT, label: "eating late" }));

    rerender(sentenceWith({ ...BY_TRANSIT, label: "home by eleven", struck: "eating late" }));

    // The struck words show at once and the new word writes in from nothing after them.
    expect(container).toHaveTextContent(/^in Lisbon, eating late, with friends$/);
  });

  it("stops its pen mid-word while still, and writes on once let go", async () => {
    const { container, rerender } = render(sentenceWith(BY_TRANSIT, true));
    rerender(sentenceWith(BY_TRANSIT));
    await waitFor(() => expect(container).toHaveTextContent(/^in Lisbon, by/));

    rerender(sentenceWith(BY_TRANSIT, false, true));
    const still = container.textContent;
    await wait(STILL_MS);

    // Only what was written stands, as a day that fades keeps its letters.
    expect(container.textContent).toBe(still);
    expect(still).not.toMatch(/transport/);

    rerender(sentenceWith(BY_TRANSIT));
    await waitFor(
      () => expect(container).toHaveTextContent(/^in Lisbon, by public transport, with friends$/),
      { timeout: WRITTEN_MS },
    );
  });

  it("brings in an assumed word the day lands with another value of whole, fading in, as the pen writes only the model's words", async () => {
    // The end the model assumed, then the one the normalizer fits to the day's hours as it lands.
    const assumedEnd: WordView = {
      ...BY_TRANSIT,
      key: "end",
      label: "home by eleven",
      listLabel: "When the day ends",
    };
    const { container, rerender } = render(sentenceWith(assumedEnd));
    await waitFor(
      () => expect(container).toHaveTextContent(/^in Lisbon, home by eleven, with friends$/),
      { timeout: WRITTEN_MS },
    );

    rerender(sentenceWith({ ...assumedEnd, label: "out late" }));

    expect(container).toHaveTextContent(/^in Lisbon, out late, with friends$/);
    const fading = [...container.querySelectorAll<HTMLElement>("span")].find(
      (span) => span.style.opacity !== "" && span.textContent === "out late",
    );
    expect(Number(fading?.style.opacity)).toBeLessThan(1);
  });
});

/** A calm day's energy word, with the five levels in its list. */
const CALM: WordView = {
  key: "energy",
  label: "calm",
  source: "chosen",
  struck: null,
  options: FACT_OPTIONS.energy.map(({ value, label }) => ({
    value,
    label,
    consequence: null,
    isCurrent: value === "calm",
  })),
  listLabel: "The day's energy",
};

/**
 * The city word's focused row, drawn on the active option while the list has the
 * keyboard's focus: the ground, and an ink ring inside the row's edge.
 */
const ACTIVE_MARK = [
  "group-focus-visible/list:bg-ground",
  "group-focus-visible/list:outline-2",
  "group-focus-visible/list:-outline-offset-2",
  "group-focus-visible/list:outline-ink",
];
/** The list's own ring: a line token inside its edge. */
const LIST_RING = [
  "focus-visible:outline-1",
  "focus-visible:-outline-offset-1",
  "focus-visible:outline-line",
];

function hasActiveMark(option: HTMLElement): boolean {
  return ACTIVE_MARK.every((name) => option.classList.contains(name));
}

/** The current option carries a quiet ink check at the end of its row; the others none. */
function hasCheck(option: HTMLElement): boolean {
  return option.querySelector("svg.lucide-check") !== null;
}

/** The open word's mark: its underline turns solid ink while its list is open. */
const OPEN_MARK = [
  "aria-expanded:underline",
  "aria-expanded:decoration-ink",
  "aria-expanded:decoration-solid",
];

describe("SentenceWord's list", () => {
  beforeAll(() => {
    // The list unfolds to its measured height; jsdom measures nothing and has no observer.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });
  afterAll(() => vi.unstubAllGlobals());

  async function openCalm() {
    const user = userEvent.setup();
    render(
      <p>
        A <SentenceWord view={CALM} isEnabled onChoose={ignore} onLight={ignore} /> Saturday
      </p>,
    );
    const word = screen.getByRole("button", { name: "calm" });
    word.focus();
    await user.keyboard("{Enter}");
    const list = screen.getByRole("listbox", { name: "The day's energy" });
    const option = (name: string) => within(list).getByRole("option", { name });
    return { user, word, list, option };
  }

  it("marks the active option with a ring and the current one with a check", async () => {
    const { user, list, option } = await openCalm();

    // Opened on the current energy, the option wears both marks.
    expect(hasActiveMark(option("calm"))).toBe(true);
    expect(hasCheck(option("calm"))).toBe(true);

    await user.keyboard("{ArrowDown}");

    expect(hasActiveMark(option("balanced"))).toBe(true);
    expect(hasCheck(option("balanced"))).toBe(false);
    expect(hasActiveMark(option("calm"))).toBe(false);
    expect(hasCheck(option("calm"))).toBe(true);
    // No option carries a bead any more, and only the current one a check.
    expect(list.querySelectorAll("circle")).toHaveLength(0);
    expect(list.querySelectorAll("svg.lucide-check")).toHaveLength(1);
    // The list keeps its own ring, whichever option is active.
    expect(list).toHaveClass(...LIST_RING);
  });

  it("leaves the word where it is, drawn once, its underline solid while its list is open", async () => {
    const { word } = await openCalm();

    // The word is the word's button alone: no copy of it is set over it as the list's top
    // row, so nothing can land a pixel off or change its colour as the list opens.
    const drawn = screen.getAllByText("calm", { exact: true });
    expect(drawn.filter((element) => element.closest('[role="listbox"]') === null)).toEqual([word]);
    expect(word).toHaveAttribute("aria-expanded", "true");
    expect(word).toHaveClass(...OPEN_MARK);
  });

  it("pressed again, rolls its list back into the word and keeps it closed", async () => {
    const { user, word } = await clickCalm();

    await user.click(word);

    // The press is the word's own toggle: a press outside the list closes it too, and must not
    // let the word's click open it again.
    await waitFor(() =>
      expect(screen.queryByRole("listbox", { name: "The day's energy" })).toBeNull(),
    );
    expect(word).toHaveAttribute("aria-expanded", "false");
    expect(word).toHaveFocus();
  });

  /** The energy word's list opened with the pointer, as a visitor's click opens it. */
  async function clickCalm() {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <p>
        A <SentenceWord view={CALM} isEnabled onChoose={onChoose} onLight={ignore} /> Saturday
      </p>,
    );
    const word = screen.getByRole("button", { name: "calm" });
    await user.click(word);
    const list = screen.getByRole("listbox", { name: "The day's energy" });
    const option = (name: string) => within(list).getByRole("option", { name });
    return { user, onChoose, word, list, option };
  }

  it("leaves the active option where it was when the pointer passes over another", async () => {
    const { user, onChoose, word, list, option } = await clickCalm();

    await user.hover(option("lively"));
    await user.unhover(option("lively"));
    expect(list).toHaveAttribute("aria-activedescendant", option("calm").id);
    await user.keyboard("{Enter}");

    // Enter takes the current energy, so the day stays as it was and the list closes.
    expect(onChoose.mock.calls).toEqual([["calm"]]);
    expect(screen.queryByRole("listbox", { name: "The day's energy" })).toBeNull();
    expect(word).toHaveFocus();
  });

  it("moves on from the active option, not from the one under the pointer", async () => {
    const { user, list, option } = await clickCalm();

    await user.hover(option("lively"));
    await user.keyboard("{ArrowDown}");

    expect(list).toHaveAttribute("aria-activedescendant", option("balanced").id);
  });

  it("reopened while it rolls back into the word, is on the current energy again", async () => {
    const { user, word, list, option } = await openCalm();
    await user.keyboard("{ArrowDown}");
    expect(list).toHaveAttribute("aria-activedescendant", option("balanced").id);

    await user.keyboard("{Escape}");
    // Still rolling back: the same list is there, and the focus is on the word.
    expect(list).toBeInTheDocument();
    expect(word).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("listbox", { name: "The day's energy" })).toBe(list);
    expect(list).toHaveFocus();
    expect(list).toHaveAttribute("aria-activedescendant", option("calm").id);
  });
});

describe("SentenceWord while another word's re-plan is written", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });
  afterAll(() => vi.unstubAllGlobals());

  it("says it is locked when pressed and opens nothing, even where the day could be changed", async () => {
    const user = userEvent.setup();
    const onLockedPress = vi.fn();
    render(
      <p>
        A{" "}
        <SentenceWord
          view={CALM}
          isEnabled
          isLocked
          onLockedPress={onLockedPress}
          onChoose={ignore}
          onLight={ignore}
        />{" "}
        Saturday
      </p>,
    );

    await user.click(screen.getByRole("button", { name: "calm" }));

    expect(onLockedPress).toHaveBeenCalledOnce();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("SentenceWord while its own re-plan is written", () => {
  function rewritten(label: string, replanning: WordReplanning, formerLabel?: string | null) {
    return (
      <p>
        early start,{" "}
        <SentenceWord
          view={{ ...BY_TRANSIT, key: "dinner", label }}
          trail=","
          replanning={replanning}
          formerLabel={formerLabel}
          isEnabled={false}
          onChoose={ignore}
          onLight={ignore}
        />{" "}
        home by eleven
      </p>
    );
  }

  /** The words a word's box holds unseen beside its own. */
  function heldIn(container: HTMLElement): (string | null)[] {
    const box = container.querySelector("button")?.parentElement;
    return [...(box?.querySelectorAll(".invisible") ?? [])].map((room) => room.textContent);
  }

  it("holds the room of the answer it replaces and its own until the day lands", () => {
    const { container, rerender } = render(rewritten("eating late", "writing", "early dinner"));

    // The wider stands, so a shorter answer never lets the words after it up a line.
    expect(heldIn(container)).toEqual(["early dinner,", "eating late,"]);
    expect(screen.getByRole("button")).toHaveAccessibleName("eating late");

    rerender(rewritten("eating late", "after", "early dinner"));

    expect(heldIn(container)).toEqual([]);
  });

  it("holds no room beyond its own where its answer keeps the sentence's lines", () => {
    const { container } = render(rewritten("eating late", "writing", null));

    expect(heldIn(container)).toEqual([]);
    expect(screen.getByRole("button")).toHaveAccessibleName("eating late");
  });

  it("holds the room of the word its pen writes over when the page names none", () => {
    const { container, rerender } = render(rewritten("early dinner", null));

    rerender(rewritten("eating late", "writing"));

    expect(heldIn(container)).toContain("early dinner,");
  });
});
