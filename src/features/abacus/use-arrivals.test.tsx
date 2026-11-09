import { act, renderHook, waitFor } from "@testing-library/react";
import { Activity, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { midOf } from "./curve";
import type { StopDraft } from "./day-draft";
import { WIRE_DRAWN_MS, useArrivals } from "./use-arrivals";

const motionMock = vi.hoisted(() => ({ isReduced: false, stops: 0 }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    useReducedMotion: () => motionMock.isReduced,
    // Counts how many slides are stopped, to check that unmounting stops them.
    animate: ((...args: Parameters<typeof actual.animate>) => {
      const controls = actual.animate(...args);
      const stop = controls.stop.bind(controls);
      controls.stop = () => {
        motionMock.stops += 1;
        stop();
      };
      return controls;
    }) as typeof actual.animate,
  };
});

beforeEach(() => {
  // Only the wires' timers are faked; the slides run on Motion's own clock.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  motionMock.isReduced = false;
  motionMock.stops = 0;
});

const CALM = 1;
/** Longer than a bead takes to fill once nothing holds it, a few frames. */
const ROOM_WAIT_MS = 200;
const STOPS: readonly StopDraft[] = ABACUS_DAY.stops;
const MORNING = STOPS[1]!;
const CASTLE = STOPS[2]!;
const CASTLE_PLACED: StopDraft = {
  ...CASTLE,
  primary: { id: CASTLE.primary.id, name: "Castillo de Santa Bárbara" },
  alternatives: [],
};

function renderArrivals(stops: readonly StopDraft[]) {
  return renderHook(({ day }) => useArrivals(day, CALM), { initialProps: { day: stops } });
}

describe("useArrivals", () => {
  it("shows the stops already there on the first render in their final state", () => {
    const { result } = renderArrivals(STOPS);

    expect(result.current.of(CASTLE)).toEqual({
      isArriving: false,
      isDrawn: true,
      isReady: true,
      isSettled: true,
      slide: null,
      grown: 1,
      eased: 1,
      isOnCurve: true,
      mid: null,
      isRewritten: false,
      hasLandedWeighed: true,
    });
    expect(result.current.isSettled).toBe(true);
  });

  it("keeps a new bead an outline until its energy is known and its wire drawn", () => {
    const { result, rerender } = renderArrivals([]);

    rerender({ day: [CASTLE_PLACED] });
    expect(result.current.of(CASTLE_PLACED)).toMatchObject({ isArriving: true, isReady: false });

    rerender({ day: [CASTLE] });
    expect(result.current.of(CASTLE).isReady).toBe(false);
    expect(result.current.isSettled).toBe(false);

    act(() => vi.advanceTimersByTime(WIRE_DRAWN_MS - 1));
    expect(result.current.of(CASTLE)).toMatchObject({ isDrawn: false, isReady: false });

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.of(CASTLE).isDrawn).toBe(true);
  });

  it("slides the bead and grows the curve on one value, then lets go", async () => {
    const { result, rerender } = renderArrivals([]);
    rerender({ day: [CASTLE] });
    act(() => vi.advanceTimersByTime(WIRE_DRAWN_MS));
    vi.useRealTimers();

    await waitFor(() => expect(result.current.of(CASTLE).slide).toBeGreaterThan(CALM));
    const arrival = result.current.of(CASTLE);
    expect(arrival.isReady).toBe(true);
    expect(arrival.grown).toBeGreaterThan(0);
    expect(arrival.eased).toBeLessThanOrEqual(1);

    await waitFor(() => expect(result.current.of(CASTLE).isSettled).toBe(true));
    expect(result.current.of(CASTLE).slide).toBeNull();
    expect(result.current.isSettled).toBe(true);
  });

  it("fills a bead without waiting for the one before, and grows its curve from there", async () => {
    const { result, rerender } = renderArrivals([]);
    rerender({ day: [MORNING, CASTLE] });
    act(() => vi.advanceTimersByTime(WIRE_DRAWN_MS));
    vi.useRealTimers();

    // Both beads fill at once; the castle's stretch of the curve waits for the curve to
    // reach the morning, so it never grows from a stop the curve has not reached.
    await waitFor(() => expect(result.current.of(MORNING).isReady).toBe(true));
    expect(result.current.of(CASTLE).isReady).toBe(true);
    expect(result.current.of(MORNING).grown).toBeLessThan(1);
    expect(result.current.of(CASTLE).isOnCurve).toBe(false);

    await waitFor(() => expect(result.current.of(CASTLE).isOnCurve).toBe(true));
    expect(result.current.of(MORNING).grown).toBe(1);
    // The day is settled only once the curve has reached the last bead too.
    await waitFor(() => expect(result.current.of(CASTLE).slide).toBeNull());
    expect(result.current.isSettled).toBe(false);
    await waitFor(() => expect(result.current.isSettled).toBe(true));
  });

  it("says whether a stop landed with its energy already written", () => {
    const { result, rerender } = renderArrivals([]);

    rerender({ day: [CASTLE_PLACED, MORNING] });
    rerender({ day: [CASTLE, MORNING] });

    // The castle landed with its name alone; the morning, held back, landed whole.
    expect(result.current.of(CASTLE).hasLandedWeighed).toBe(false);
    expect(result.current.of(MORNING).hasLandedWeighed).toBe(true);
  });

  it("keeps a bead hollow until its row's room is open, and fills it in that frame", async () => {
    const { result, rerender } = renderArrivals([]);
    rerender({ day: [CASTLE] });
    act(() => result.current.onRoomsOpen(new Set()));
    act(() => vi.advanceTimersByTime(WIRE_DRAWN_MS));
    vi.useRealTimers();

    // Drawn and with its energy known, it still waits for its room.
    await new Promise((resolve) => window.setTimeout(resolve, ROOM_WAIT_MS));
    expect(result.current.of(CASTLE).isReady).toBe(false);
    expect(result.current.isSettled).toBe(false);

    // The rows say its room is open as they lay out a frame: the bead fills in that render,
    // before its slide takes its first step.
    act(() => result.current.onRoomsOpen(new Set([CASTLE.id])));
    expect(result.current.of(CASTLE)).toMatchObject({ isReady: true, slide: CALM });
  });

  it("shows a new stop in its final state under reduced motion", () => {
    motionMock.isReduced = true;
    const { result, rerender } = renderArrivals([]);

    rerender({ day: [CASTLE] });

    expect(result.current.of(CASTLE)).toMatchObject({
      isArriving: false,
      isReady: true,
      isSettled: true,
    });
  });

  it("stops its wires and slides when it unmounts", async () => {
    const { result, rerender, unmount } = renderArrivals([]);
    rerender({ day: [MORNING, CASTLE] });
    act(() => vi.advanceTimersByTime(WIRE_DRAWN_MS));
    rerender({ day: [MORNING, CASTLE, STOPS[3]!] });
    vi.useRealTimers();
    await waitFor(() => expect(result.current.of(MORNING).isReady).toBe(true));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    rerender({ day: [MORNING, CASTLE, STOPS[3]!, STOPS[4]!] });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(motionMock.stops).toBeGreaterThan(0);
  });

  it("starts what was unfinished again when it is hidden and shown", () => {
    const activity = { mode: "visible" as "visible" | "hidden" };
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <Activity mode={activity.mode}>{children}</Activity>
    );
    const { result, rerender } = renderHook(({ day }) => useArrivals(day, CALM), {
      initialProps: { day: [] as readonly StopDraft[] },
      wrapper: Wrapper,
    });
    rerender({ day: [CASTLE] });

    activity.mode = "hidden";
    rerender({ day: [CASTLE] });
    act(() => vi.advanceTimersByTime(WIRE_DRAWN_MS));
    activity.mode = "visible";
    rerender({ day: [CASTLE] });
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(WIRE_DRAWN_MS));
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.of(CASTLE).isArriving).toBe(true);
  });
});

describe("a stop written again", () => {
  const BALANCED = 2;
  const LIVELY = 3;
  /** `layout` bounces a little past its target. */
  const SPRING_OVERSHOOT = 0.2;
  const ORIGINS = { [CASTLE.id]: { energy: BALANCED, mid: midOf([CASTLE], CASTLE) } };
  /** The castle emptied by a re-composition: a new place, nothing of it written yet. */
  const EMPTIED: StopDraft = {
    ...CASTLE,
    primary: { id: "stop-2:r1:p" },
    alternatives: [],
    selectedPlaceId: "stop-2:r1:p",
  };
  /** Its rewrite, half an hour later and livelier. */
  const REWRITTEN: StopDraft = {
    ...EMPTIED,
    startTime: "10:15",
    primary: { id: "stop-2:r1:p", name: "Rambla", sensory: { energy: "lively" } },
  };

  function renderRewrite() {
    return renderHook(({ day }) => useArrivals(day, CALM, ORIGINS), {
      initialProps: { day: [CASTLE] as readonly StopDraft[] },
    });
  }

  it("empties its bead where it was, keeping its wire and its place on the curve", () => {
    const { result, rerender } = renderRewrite();

    rerender({ day: [EMPTIED] });

    expect(result.current.of(EMPTIED)).toMatchObject({
      isRewritten: true,
      isDrawn: true,
      isReady: false,
      isOnCurve: true,
      slide: BALANCED,
      mid: null,
    });
  });

  it("glides to its new time, then slides from where it was to its new energy", async () => {
    const { result, rerender } = renderRewrite();
    rerender({ day: [EMPTIED] });
    vi.useRealTimers();

    rerender({ day: [REWRITTEN] });
    expect(result.current.of(REWRITTEN).mid).toBe(midOf([CASTLE], CASTLE));

    await waitFor(() =>
      expect(result.current.of(REWRITTEN).mid).toBeGreaterThan(midOf([CASTLE], CASTLE)),
    );
    expect(result.current.of(REWRITTEN).slide).toBe(BALANCED);

    await waitFor(() => expect(result.current.of(REWRITTEN).slide).toBeGreaterThan(BALANCED));
    expect(result.current.of(REWRITTEN).mid).toBeNull();

    expect(result.current.of(REWRITTEN).slide).toBeLessThanOrEqual(LIVELY + SPRING_OVERSHOOT);

    await waitFor(() => expect(result.current.of(REWRITTEN).isSettled).toBe(true));
    expect(result.current.of(REWRITTEN).slide).toBeNull();
  });
});
