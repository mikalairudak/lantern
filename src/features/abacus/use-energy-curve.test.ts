import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { candidatesOf, curveAt, midsOf } from "./curve";
import type { StopDraft } from "./day-draft";
import { useEnergyCurve, type EnergyCurve } from "./use-energy-curve";

const settles = vi.hoisted(() => ({ stopped: 0 }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    // Counts the settle springs that are stopped, to check that unmounting stops them.
    animate: ((...args: Parameters<typeof actual.animate>) => {
      const controls = actual.animate(...args);
      const stop = controls.stop.bind(controls);
      controls.stop = () => {
        settles.stopped += 1;
        stop();
      };
      return controls;
    }) as typeof actual.animate,
  };
});

afterEach(() => {
  settles.stopped = 0;
});

const STOPS: readonly StopDraft[] = ABACUS_DAY.stops;
const LUNCH = 4;
const MIDS = midsOf(STOPS);

function renderCurve(stops: readonly StopDraft[] = STOPS) {
  return renderHook(({ day }) => useEnergyCurve(day), { initialProps: { day: stops } });
}

function shownName(curve: EnergyCurve, stops: readonly StopDraft[], index: number): string {
  const stop = stops[index]!;
  return candidatesOf(stop)[curve.selected[index]!]?.name ?? "";
}

describe("useEnergyCurve", () => {
  it("starts from the model's picks, with the curve on their energies", () => {
    const { result } = renderCurve();

    expect(result.current.selected).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.current.committed).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.current.curve).toEqual([0, 1, 2, 3, 1, 0, 2, 4]);
  });

  it("gives a stop that arrives later its model pick, and keeps the picks already made", () => {
    const { result, rerender } = renderCurve(STOPS.slice(0, 5));

    act(() => result.current.choose(LUNCH, 1));
    rerender({ day: STOPS });

    expect(shownName(result.current, STOPS, LUNCH)).toBe("Arroz a banda by the port");
    expect(result.current.committed[LUNCH]).toBe(1);
    expect(result.current.selected.slice(5)).toEqual([0, 0, 0]);
    expect(result.current.curve[7]).toBe(4);
  });

  it("keeps a pick when an alternative arrives ahead of it", () => {
    const morning = STOPS[1]!;
    const partial = [STOPS[0]!, { ...morning, alternatives: morning.alternatives.slice(1) }];
    const { result, rerender } = renderCurve(partial);

    act(() => result.current.choose(1, 1));
    rerender({ day: STOPS.slice(0, 2) });

    expect(result.current.selected[1]).toBe(2);
    expect(shownName(result.current, STOPS, 1)).toBe("Calle Mayor");
  });

  it("leaves a stop off the curve until its energy is written", () => {
    const castle = STOPS[2]!;
    const unwritten: StopDraft = {
      ...castle,
      primary: { id: castle.primary.id, name: "Castillo" },
      alternatives: [],
    };
    const { result, rerender } = renderCurve([STOPS[0]!, STOPS[1]!, unwritten]);

    expect(result.current.curve).toEqual([0, 1, null]);
    expect(result.current.selected).toEqual([0, 0, 0]);

    rerender({ day: STOPS.slice(0, 3) });

    expect(result.current.curve).toEqual([0, 1, 2]);
  });

  it("switches a stop only when another candidate is clearly nearer while dragged", () => {
    const { result } = renderCurve();

    act(() => result.current.startDrag(MIDS[LUNCH]!));
    act(() => result.current.drag(-0.6));
    expect(shownName(result.current, STOPS, LUNCH)).toBe("Paella on the marina");

    act(() => result.current.drag(-0.7));
    expect(shownName(result.current, STOPS, LUNCH)).toBe("Arroz a banda by the port");

    act(() => result.current.drag(-0.45));
    expect(shownName(result.current, STOPS, LUNCH)).toBe("Arroz a banda by the port");
    expect(result.current.committed[LUNCH]).toBe(0);
  });

  it("commits the chart's picks to the list on release", () => {
    const { result } = renderCurve();

    act(() => result.current.startDrag(MIDS[LUNCH]!));
    act(() => result.current.drag(-0.8));
    expect(result.current.isDragging).toBe(true);
    expect(result.current.committed[LUNCH]).toBe(0);

    act(() => result.current.endDrag());

    expect(result.current.isDragging).toBe(false);
    expect(result.current.committed[LUNCH]).toBe(1);
  });

  it("settles the curve onto the picks after release", async () => {
    const { result } = renderCurve();

    act(() => result.current.startDrag(MIDS[LUNCH]!));
    act(() => result.current.drag(-0.8));
    expect(result.current.curve[LUNCH]).toBeCloseTo(0.2);
    act(() => result.current.endDrag());

    await waitFor(() => expect(result.current.curve[LUNCH]).toBeCloseTo(0, 2));
  });

  it("keeps the grabbed point under the pointer between stops and stops it at the scale's end", () => {
    const { result } = renderCurve();
    const between = (MIDS[3]! + MIDS[LUNCH]!) / 2;
    const levels = () => result.current.curve.map((level) => level ?? 0);
    const grabbed = curveAt(levels(), MIDS, between);

    act(() => result.current.startDrag(between));
    act(() => result.current.drag(0.5));
    // The gain is an estimate between stops: within a tenth of a level, a few pixels.
    expect(Math.abs(curveAt(levels(), MIDS, between) - (grabbed + 0.5))).toBeLessThan(0.1);

    act(() => result.current.drag(10));
    const atTheEnd = levels();
    act(() => result.current.drag(20));
    expect(levels()).toEqual(atTheEnd);
    expect(Math.max(...atTheEnd)).toBeLessThanOrEqual(4);
  });

  it("ignores picks, pulls and resets while the curve is held", () => {
    const { result } = renderCurve();

    act(() => result.current.startDrag(MIDS[0]!));
    act(() => {
      result.current.choose(LUNCH, 2);
      result.current.pullTo(LUNCH, 0);
      result.current.reset();
    });

    expect(result.current.selected).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.current.committed).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("pulls one stop onto a version while distant neighbours keep theirs", () => {
    const { result } = renderCurve();

    act(() => result.current.pullTo(LUNCH, 0));

    expect(shownName(result.current, STOPS, LUNCH)).toBe("Arroz a banda by the port");
    expect(result.current.committed).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
  });

  it("stops the settling spring when it unmounts", () => {
    const { result, unmount } = renderCurve();

    act(() => result.current.choose(LUNCH, 1));
    const stoppedWhileMounted = settles.stopped;

    unmount();

    expect(settles.stopped).toBeGreaterThan(stoppedWhileMounted);
  });

  it("resets every stop to the model's selection, including ones added since", () => {
    const { result, rerender } = renderCurve(STOPS.slice(0, 5));

    act(() => {
      result.current.choose(1, 2);
      result.current.choose(LUNCH, 1);
    });
    rerender({ day: STOPS });
    act(() => result.current.reset());

    expect(result.current.selected).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(result.current.committed).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("restore", () => {
  it("shows the picks at once, as no gesture, the curve resting on what each stop shows", () => {
    const { result } = renderCurve();
    const lunch = candidatesOf(STOPS[LUNCH]!)[1]!;

    act(() => result.current.restore({ [STOPS[LUNCH]!.id]: lunch.id }));

    expect(result.current.selected).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(result.current.committed).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(shownName(result.current, STOPS, LUNCH)).toBe("Arroz a banda by the port");
    // At rest on the version shown from the same frame: a swap's spring holds it where it was.
    expect(result.current.curve[LUNCH]).toBe(0);
  });

  it("shows the model's pick for a stop whose kept place is none of its versions", () => {
    const { result } = renderCurve();

    act(() => result.current.restore({ [STOPS[LUNCH]!.id]: "another-place" }));

    expect(result.current.committed).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("changes nothing while the curve is held", () => {
    const { result } = renderCurve();
    const lunch = candidatesOf(STOPS[LUNCH]!)[1]!;

    act(() => result.current.startDrag(MIDS[0]!));
    act(() => result.current.restore({ [STOPS[LUNCH]!.id]: lunch.id }));

    expect(result.current.committed).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("previewOf", () => {
  it("gives the day a drag would leave, as its release would settle it, and changes nothing", () => {
    const { result } = renderCurve();
    const before = { ...result.current };

    const preview = result.current.previewOf(MIDS[LUNCH]!, -0.8);

    // The same pull as a drag of 0.8 levels, released: lunch shows Arroz a banda by the port, at rest on it.
    expect(preview?.selected).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    expect(preview?.curve[LUNCH]).toBeCloseTo(0);
    expect(result.current.selected).toEqual(before.selected);
    expect(result.current.committed).toEqual(before.committed);
    expect(result.current.curve).toEqual(before.curve);
  });

  it("gives the day as it is where the pull switches no stop", () => {
    const { result } = renderCurve();

    expect(result.current.previewOf(MIDS[LUNCH]!, -0.3)?.selected).toEqual(result.current.selected);
  });

  it("starts from the picks already made", () => {
    const { result } = renderCurve();
    act(() => result.current.pullTo(LUNCH, 0));

    expect(result.current.previewOf(MIDS[LUNCH]!, 0)?.selected[LUNCH]).toBe(1);
  });

  it("gives nothing while the curve is held, nor for a day with no stop on the curve", () => {
    const { result } = renderCurve();
    act(() => result.current.startDrag(MIDS[LUNCH]!));
    expect(result.current.previewOf(MIDS[LUNCH]!, -0.8)).toBeNull();

    const unweighed = STOPS.map((stop) => ({ ...stop, primary: { id: stop.primary.id } }));
    expect(renderCurve(unweighed).result.current.previewOf(MIDS[LUNCH]!, 1)).toBeNull();
  });
});
