import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SILENCE_SECONDS, WHOLE_ROWS_SILENCE_SECONDS, useSilence } from "./use-silence";

const MS_PER_SECOND = 1000;
/** Short of a silence by this much, then past it by this much. */
const MARGIN_MS = 10;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useSilence", () => {
  it("falls silent once what it watches has stood a silence's length", () => {
    const { result } = renderHook(() => useSilence("a row", true));

    act(() => vi.advanceTimersByTime(SILENCE_SECONDS * MS_PER_SECOND - MARGIN_MS));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(2 * MARGIN_MS));
    expect(result.current).toBe(true);
  });

  it("counts again from what changes, and never while it is not watching", () => {
    const { result, rerender } = renderHook(
      ({ shown, isWatching }) => useSilence(shown, isWatching),
      { initialProps: { shown: "one row", isWatching: true } },
    );
    act(() => vi.advanceTimersByTime(SILENCE_SECONDS * MS_PER_SECOND + MARGIN_MS));
    expect(result.current).toBe(true);

    rerender({ shown: "two rows", isWatching: true });
    expect(result.current).toBe(false);
    rerender({ shown: "two rows", isWatching: false });
    act(() => vi.advanceTimersByTime(SILENCE_SECONDS * MS_PER_SECOND * 2));
    expect(result.current).toBe(false);
  });

  it("waits the longer silence it is given, as when rows land whole", () => {
    const { result } = renderHook(() => useSilence("a row", true, WHOLE_ROWS_SILENCE_SECONDS));

    act(() => vi.advanceTimersByTime(SILENCE_SECONDS * MS_PER_SECOND + MARGIN_MS));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(WHOLE_ROWS_SILENCE_SECONDS * MS_PER_SECOND));
    expect(result.current).toBe(true);
  });
});
