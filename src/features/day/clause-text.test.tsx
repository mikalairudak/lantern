import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClauseText,
  OWED_CLAUSE_STANDS_MS,
  owedClauseOf,
  setOff,
  useHasStood,
  type ClauseMoment,
} from "./clause-text";

function sentenceAt(text: string) {
  return render(
    <p>
      A lively Saturday
      <ClauseText text={text} isWriting /> in Lisbon
    </p>,
  ).container;
}

describe("ClauseText", () => {
  it("keeps its opening comma back until its first letter is written", () => {
    const clause = setOff("quieter at lunch");

    expect(sentenceAt(clause.slice(0, 1))).toHaveTextContent(/^A lively Saturday in Lisbon$/);
    expect(sentenceAt(clause.slice(0, 2))).toHaveTextContent(/^A lively Saturday in Lisbon$/);
    expect(sentenceAt(clause.slice(0, 3))).toHaveTextContent(/^A lively Saturday, q in Lisbon$/);
  });

  it("closes with its comma once written in full", () => {
    expect(sentenceAt(setOff("quieter at lunch"))).toHaveTextContent(
      /^A lively Saturday, quieter at lunch, in Lisbon$/,
    );
  });
});

describe("owedClauseOf", () => {
  const CLAUSE = "livelier at lunch";
  const STILL: ClauseMoment = { isOpening: false, isPanelOpen: false, isOwedWhole: false };

  it("owes a clause once the sentence's row glides open for it", () => {
    expect(owedClauseOf(null, CLAUSE, { ...STILL, isOpening: true })).toBe(CLAUSE);
    // Its line open, it stays owed while the curve keeps it.
    expect(owedClauseOf(CLAUSE, CLAUSE, STILL)).toBe(CLAUSE);
  });

  it("owes nothing for a clause that opened no line", () => {
    expect(owedClauseOf(null, CLAUSE, STILL)).toBeNull();
    expect(owedClauseOf(null, null, STILL)).toBeNull();
  });

  it("keeps a clause the curve let go owed until it is written whole", () => {
    expect(owedClauseOf(CLAUSE, null, STILL)).toBe(CLAUSE);
    expect(owedClauseOf(CLAUSE, null, { ...STILL, isOwedWhole: true })).toBeNull();
  });

  it("keeps the debt as it stands while a word's panel is open", () => {
    const underHand = { ...STILL, isPanelOpen: true };

    expect(owedClauseOf(CLAUSE, null, { ...underHand, isOwedWhole: true })).toBe(CLAUSE);
    expect(owedClauseOf(null, CLAUSE, { ...underHand, isOpening: true })).toBeNull();
  });

  it("drops a debt to a clause the curve has replaced with one that opened no line", () => {
    expect(owedClauseOf(CLAUSE, "quieter at lunch", STILL)).toBeNull();
  });
});

describe("useHasStood", () => {
  const CLAUSE = "livelier at lunch";
  const ALMOST = OWED_CLAUSE_STANDS_MS - 1;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderStand(clause: string | null, isStanding: boolean) {
    return renderHook(({ clause: owed, isStanding: standing }) => useHasStood(owed, standing), {
      initialProps: { clause, isStanding },
    });
  }

  it("says a clause has stood once it has stood whole its time, and not a moment before", () => {
    const { result } = renderStand(CLAUSE, true);

    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(ALMOST));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("starts its time over when the clause stops standing whole, so it is never paid at once on its return", () => {
    const { result, rerender } = renderStand(CLAUSE, true);
    act(() => vi.advanceTimersByTime(OWED_CLAUSE_STANDS_MS));
    expect(result.current).toBe(true);

    // Its line glides again, a panel's hand or a row's: the clause stands whole no longer.
    rerender({ clause: CLAUSE, isStanding: false });
    expect(result.current).toBe(false);
    rerender({ clause: CLAUSE, isStanding: true });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(ALMOST));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("gives each new clause its own time", () => {
    const { result, rerender } = renderStand(CLAUSE, true);
    act(() => vi.advanceTimersByTime(OWED_CLAUSE_STANDS_MS));

    rerender({ clause: "quieter at dinner", isStanding: true });

    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(OWED_CLAUSE_STANDS_MS));
    expect(result.current).toBe(true);
  });
});
