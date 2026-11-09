import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ROW, type LabelSide } from "./rows";
import { useWordsX } from "./use-words-x";

const motionMock = vi.hoisted(() => ({ isReduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionMock.isReduced };
});

afterEach(() => {
  motionMock.isReduced = false;
});

function renderWords(beadX: number, side: LabelSide, width: number) {
  return renderHook((props) => useWordsX(props.beadX, props.side, props.width), {
    initialProps: { beadX, side, width },
  });
}

describe("useWordsX", () => {
  it("starts words on the right just past their bead", () => {
    const { result } = renderWords(200, "right", 120);

    expect(result.current.get()).toBe(200 + ROW.beadClear);
  });

  it("ends words on the left just short of their bead", () => {
    const { result } = renderWords(300, "left", 120);

    expect(result.current.get()).toBe(300 - ROW.beadClear - 120);
  });

  it("grows words on the left leftwards at once, letter by letter", () => {
    const { result, rerender } = renderWords(300, "left", 40);

    rerender({ beadX: 300, side: "left", width: 48 });

    expect(result.current.get()).toBe(300 - ROW.beadClear - 48);
  });

  it("rides a sliding bead at once, while a change of side still glides", () => {
    const { result, rerender } = renderHook(
      (props) => useWordsX(props.beadX, props.side, 120, false, props.isRiding),
      { initialProps: { beadX: 200, side: "right" as LabelSide, isRiding: true } },
    );

    rerender({ beadX: 230, side: "right", isRiding: true });
    expect(result.current.get()).toBe(230 + ROW.beadClear);

    rerender({ beadX: 260, side: "left", isRiding: true });
    // The bead's place is taken at once; the words have not crossed to its left yet.
    expect(result.current.get()).toBe(260 + ROW.beadClear);
  });

  it("moves at once to a new bead and side under reduced motion", () => {
    motionMock.isReduced = true;
    const { result, rerender } = renderWords(300, "left", 120);

    rerender({ beadX: 100, side: "right", width: 120 });

    expect(result.current.get()).toBe(100 + ROW.beadClear);
  });
});
