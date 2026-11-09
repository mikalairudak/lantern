import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Keyframe } from "./pacing";
import { usePlayback } from "./use-playback";

const reducedMotion = vi.hoisted(() => ({ isOn: false }));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reducedMotion.isOn,
}));

const KEYFRAMES: readonly Keyframe[] = [
  { seconds: 0, budget: 0 },
  { seconds: 1, budget: 100 },
  { seconds: 2, budget: 100 },
  { seconds: 3, budget: 600 },
];
const LIVE = { boundaries: [] };
const MS_PER_SECOND = 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
});

afterEach(() => {
  vi.useRealTimers();
  reducedMotion.isOn = false;
});

describe("usePlayback", () => {
  it("starts from nothing, so the server and the first client render match", () => {
    const { result } = renderHook(() => usePlayback(KEYFRAMES));

    expect(result.current).toEqual({ written: 0, isWaiting: false });
  });

  it("follows the keyframes, pausing where they pause, to the whole day", () => {
    const { result } = renderHook(() => usePlayback(KEYFRAMES));

    act(() => vi.advanceTimersByTime(0.5 * MS_PER_SECOND));
    expect(result.current.written).toBeGreaterThan(40);
    expect(result.current.written).toBeLessThan(60);

    act(() => vi.advanceTimersByTime(1 * MS_PER_SECOND));
    expect(result.current.written).toBe(100);

    act(() => vi.advanceTimersByTime(2 * MS_PER_SECOND));
    expect(result.current.written).toBe(600);
  });

  it("waits in the silence between two bursts, not while they flow", () => {
    const { result } = renderHook(() => usePlayback(KEYFRAMES));

    act(() => vi.advanceTimersByTime(0.9 * MS_PER_SECOND));
    expect(result.current.isWaiting).toBe(false);

    act(() => vi.advanceTimersByTime(0.6 * MS_PER_SECOND));
    expect(result.current.isWaiting).toBe(true);

    act(() => vi.advanceTimersByTime(0.6 * MS_PER_SECOND));
    expect(result.current.isWaiting).toBe(false);
  });

  it("starts complete when asked to", () => {
    const { result } = renderHook(() => usePlayback(KEYFRAMES, { startsComplete: true }));

    expect(result.current.written).toBe(600);
  });

  it("shows a replayed day at once with reduced motion", () => {
    reducedMotion.isOn = true;
    const { result } = renderHook(() => usePlayback(KEYFRAMES));

    act(() => vi.advanceTimersByTime(20));
    expect(result.current.written).toBe(600);
  });

  it("still lets a live stream arrive piece by piece with reduced motion", () => {
    reducedMotion.isOn = true;
    const { result } = renderHook(() => usePlayback(KEYFRAMES, { live: LIVE }));

    act(() => vi.advanceTimersByTime(0.5 * MS_PER_SECOND));
    expect(result.current.written).toBeLessThan(600);
  });
});
