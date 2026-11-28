import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAID_AGAIN_PAUSE_MS, useSaidAgain } from "./said-again";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a status's line said again at each act", () => {
  it("is said at once for the count it is drawn with", () => {
    const { result } = renderHook(({ acts }) => useSaidAgain(acts), { initialProps: { acts: 2 } });

    expect(result.current).toBe(true);
  });

  it("stands empty for the pause after an act, then says the line", () => {
    const { result, rerender } = renderHook(({ acts }) => useSaidAgain(acts), {
      initialProps: { acts: 0 },
    });

    rerender({ acts: 1 });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(SAID_AGAIN_PAUSE_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("counts the pause from the latest of two acts close together", () => {
    const { result, rerender } = renderHook(({ acts }) => useSaidAgain(acts), {
      initialProps: { acts: 0 },
    });

    rerender({ acts: 1 });
    act(() => vi.advanceTimersByTime(SAID_AGAIN_PAUSE_MS / 2));
    rerender({ acts: 2 });
    act(() => vi.advanceTimersByTime(SAID_AGAIN_PAUSE_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("pauses for longer than two frames, not for one", () => {
    const FRAME_MS = 1000 / 60;
    expect(SAID_AGAIN_PAUSE_MS).toBeGreaterThan(FRAME_MS * 2);
  });
});
