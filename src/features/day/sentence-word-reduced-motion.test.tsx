import { act, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SentenceWord, type WordPair, type WordView } from "./sentence-word";

/** A device that asks for reduced motion: the pen writes every word at once. */
function reducedMotion(query: string): MediaQueryList {
  return {
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

beforeAll(() => vi.stubGlobal("matchMedia", reducedMotion));
afterAll(() => vi.unstubAllGlobals());

const ignore = () => undefined;

const EARLY_DINNER: WordView = {
  key: "dinner",
  label: "early dinner",
  source: "assumed",
  struck: null,
  options: [],
  listLabel: "When you eat dinner",
};

const EATING_LATE: WordPair = {
  label: "eating late",
  state: "being written",
  isLit: true,
  onPoint: ignore,
};

function headlineWith(pair: WordPair | null) {
  return (
    <h1>
      in Elche,
      <SentenceWord
        view={EARLY_DINNER}
        lead=" "
        trail=","
        pair={pair}
        isEnabled
        onChoose={ignore}
        onLight={ignore}
      />{" "}
      home by eleven
    </h1>
  );
}

describe("SentenceWord's pair with reduced motion", () => {
  it("hands a focus on the pair to the word as the pair goes at once with its fork", () => {
    const { rerender } = render(headlineWith(EATING_LATE));
    const pair = screen.getByRole("button", { name: "eating late, being written: go to it" });
    act(() => pair.focus());

    rerender(headlineWith(null));

    expect(pair).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "early dinner" })).toHaveFocus();
  });

  it("leaves a focus elsewhere where it is as the pair goes", () => {
    const { rerender } = render(headlineWith(EATING_LATE));
    const elsewhere = document.body.appendChild(document.createElement("button"));
    act(() => elsewhere.focus());

    rerender(headlineWith(null));

    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });
});
