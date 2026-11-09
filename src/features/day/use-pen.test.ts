import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PEN_BEAT_MS, usePen } from "./use-pen";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("usePen", () => {
  it("reaches what arrived together one piece a beat, the first at once", () => {
    const { result } = renderHook(() => usePen(3));

    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(PEN_BEAT_MS - 1));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(2);
    act(() => vi.advanceTimersByTime(PEN_BEAT_MS));
    expect(result.current).toBe(3);
  });

  it("reaches a piece at once after a pause longer than its beat", () => {
    const { result, rerender } = renderHook(({ arrived }) => usePen(arrived), {
      initialProps: { arrived: 1 },
    });
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(PEN_BEAT_MS * 4));

    rerender({ arrived: 2 });
    act(() => vi.advanceTimersByTime(0));

    expect(result.current).toBe(2);
  });

  it("reaches nothing more while held, as while a line opens, and goes on once let go", () => {
    const { result, rerender } = renderHook(
      ({ arrived, isHeld }) => usePen(arrived, PEN_BEAT_MS, isHeld),
      { initialProps: { arrived: 1, isHeld: false } },
    );
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(PEN_BEAT_MS * 4));

    // A word arrives after a pause, as its line starts to open: the pen would write it at once.
    rerender({ arrived: 2, isHeld: true });
    act(() => vi.advanceTimersByTime(PEN_BEAT_MS * 4));
    expect(result.current).toBe(1);

    rerender({ arrived: 2, isHeld: false });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBe(2);
  });

  it("never says more than has arrived, and keeps its own beat", () => {
    const beat = PEN_BEAT_MS * 2;
    const { result, rerender } = renderHook(({ arrived }) => usePen(arrived, beat), {
      initialProps: { arrived: 2 },
    });
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(PEN_BEAT_MS));
    expect(result.current).toBe(1);
    act(() => vi.advanceTimersByTime(PEN_BEAT_MS));
    expect(result.current).toBe(2);

    rerender({ arrived: 0 });
    expect(result.current).toBe(0);
  });
});
