import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLightInPhase } from "./day-stage-header";

/** A headline whose light set off at `startTime`, as the browser's CSS animation reports it. */
function litHeadline(startTime: number) {
  const light = { animationName: "pass", startTime };
  const element = { getAnimations: () => [light] } as unknown as HTMLElement;
  return { ref: { current: element }, light };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("a headline's light", () => {
  it("goes on in the phase of one still lit, and sets off afresh once none has been", () => {
    vi.useFakeTimers();
    const copy = litHeadline(100);
    const first = renderHook(() => useLightInPhase(copy.ref, true));

    // The live header takes over while the copy is lit: it runs the copy's light on.
    const live = litHeadline(400);
    const second = renderHook(() => useLightInPhase(live.ref, true));
    expect(live.light.startTime).toBe(100);

    // The copy goes as the live header lights, within the hand-over: still in phase.
    first.unmount();
    const again = litHeadline(450);
    const third = renderHook(() => useLightInPhase(again.ref, true));
    expect(again.light.startTime).toBe(100);

    // Every light goes out for longer than the hand-over: a later one keeps its own start.
    second.unmount();
    third.unmount();
    vi.advanceTimersByTime(1000);
    const later = litHeadline(5000);
    const fourth = renderHook(() => useLightInPhase(later.ref, true));
    expect(later.light.startTime).toBe(5000);
    fourth.unmount();
    vi.advanceTimersByTime(1000);
  });
});
