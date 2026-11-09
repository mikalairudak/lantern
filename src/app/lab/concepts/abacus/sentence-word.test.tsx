import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ALICANTE_FACTS, type FactKey } from "./facts";
import { wordViewsOf } from "./request-sentence";
import { SentenceWord } from "@/features/day/sentence-word";

const WORDS = wordViewsOf(ALICANTE_FACTS, ({ value }) =>
  value === "family" ? "dinner by eight" : null,
);

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

interface WordOptions {
  key?: FactKey;
  isEnabled?: boolean;
}

function renderWord({ key = "company", isEnabled = true }: WordOptions = {}) {
  const onChoose = vi.fn();
  const onLight = vi.fn();
  render(
    <>
      <h1>
        <SentenceWord
          view={WORDS[key]}
          isEnabled={isEnabled}
          onChoose={onChoose}
          onLight={onLight}
        />
      </h1>
      <button type="button">Elsewhere</button>
    </>,
  );
  const word = screen.getByRole("button", { name: WORDS[key].label });
  return { word, onChoose, onLight };
}

describe("a word of the request", () => {
  it("opens its options as a list, marking none chosen while the question is open", async () => {
    const user = userEvent.setup();
    const { word } = renderWord();

    expect(word).toHaveAttribute("aria-haspopup", "listbox");
    expect(word).toHaveAttribute("aria-expanded", "false");

    await user.click(word);

    const list = screen.getByRole("listbox", { name: "Who is coming" });
    expect(word).toHaveAttribute("aria-expanded", "true");
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["alone", "with a partner", "with familydinner by eight", "with friends"]);
    expect(within(list).queryByRole("option", { selected: true })).not.toBeInTheDocument();
  });

  it("marks the current option of an assumption as selected", async () => {
    const user = userEvent.setup();
    const { word } = renderWord({ key: "dinner" });

    await user.click(word);

    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("eating late");
  });

  it("moves through the options with the arrow keys and chooses with Enter", async () => {
    const user = userEvent.setup();
    const { word, onChoose } = renderWord();

    word.focus();
    await user.keyboard("{Enter}");
    const list = screen.getByRole("listbox");
    expect(list).toHaveFocus();
    const active = () =>
      document.getElementById(list.getAttribute("aria-activedescendant") ?? "")?.textContent;
    expect(active()).toBe("alone");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(active()).toMatch(/^with family/);

    await user.keyboard("{ArrowUp}");
    expect(active()).toBe("with a partner");

    await user.keyboard("{End}{Enter}");

    expect(onChoose).toHaveBeenCalledWith("friends");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(word).toHaveFocus();
  });

  it("chooses an option when it is clicked", async () => {
    const user = userEvent.setup();
    const { word, onChoose } = renderWord();

    await user.click(word);
    await user.click(screen.getByRole("option", { name: /with family/ }));

    expect(onChoose).toHaveBeenCalledWith("family");
  });

  it("closes with Escape and gives the focus back to the word", async () => {
    const user = userEvent.setup();
    const { word, onChoose } = renderWord();

    await user.click(word);
    await user.keyboard("{Escape}");

    expect(word).toHaveAttribute("aria-expanded", "false");
    expect(word).toHaveFocus();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("closes when the visitor presses anywhere else", async () => {
    const user = userEvent.setup();
    const { word } = renderWord();

    await user.click(word);
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));

    expect(word).toHaveAttribute("aria-expanded", "false");
  });

  it("stays shut while the day cannot be changed", async () => {
    const user = userEvent.setup();
    const { word } = renderWord({ isEnabled: false });

    await user.click(word);

    expect(word).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("lights the stops it shaped while it is hovered or focused", async () => {
    const user = userEvent.setup();
    const { word, onLight } = renderWord();

    await user.hover(word);
    expect(onLight).toHaveBeenLastCalledWith(true);

    await user.unhover(word);
    expect(onLight).toHaveBeenLastCalledWith(false);
  });
});
