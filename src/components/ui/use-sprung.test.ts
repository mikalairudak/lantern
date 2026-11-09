import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpringName } from "@/lib/tokens/motion";
import { useSprung, useSprungAll } from "./use-sprung";

const motionMock = vi.hoisted(() => ({ isReduced: false }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionMock.isReduced };
});

afterEach(() => {
  motionMock.isReduced = false;
});

function renderSprung(targets: readonly number[]) {
  return renderHook(({ values }) => useSprungAll(values), { initialProps: { values: targets } });
}

/** Renders the set and keeps every value its first number is drawn at, frame by frame. */
function renderDrawn(targets: readonly number[], kinds: readonly SpringName[] = []) {
  const drawn: number[] = [];
  const hook = renderHook(
    ({ values }) => {
      const sprung = useSprungAll(values, false, kinds);
      drawn.push(sprung[0] ?? Number.NaN);
      return sprung;
    },
    { initialProps: { values: targets } },
  );
  return { ...hook, drawn };
}

/** Long enough for a spring that runs on past its target to come back to it, under load. */
const SETTLED = { timeout: 3000 };
/** Well on its way from 0 to 100, and still fast. */
const OUT_ON_ITS_WAY = 40;
/** Sent this much further on, less than it would go at its speed before it stops. */
const A_LITTLE_FURTHER = 10;
/** A quarter of a 100 px way: the spring takes four times as long over it. */
const REACH_PX = 25;
/** The layout spring's visual duration, 0.4 s, with a little to spare. */
const LAYOUT_SETTLES_MS = 450;
const NEARLY_THERE = 90;
const WELL_SHORT = 70;

describe("useSprungAll", () => {
  it("starts where it is told to be", () => {
    const { result } = renderSprung([100, 200]);

    expect(result.current).toEqual([100, 200]);
  });

  it("springs every number to its new target together", async () => {
    const { result, rerender } = renderSprung([100, 200]);

    rerender({ values: [140, 240] });

    expect(result.current).toEqual([100, 200]);
    await waitFor(() => expect(result.current[0]).toBeGreaterThan(100));
    await waitFor(() => expect(result.current).toEqual([140, 240]));
  });

  it("puts a number new to the set straight at its target", () => {
    const { result, rerender } = renderSprung([100]);

    rerender({ values: [100, 300] });

    expect(result.current).toEqual([100, 300]);
  });

  it("follows a shorter set when numbers leave it", () => {
    const { result, rerender } = renderSprung([100, 200, 300]);

    rerender({ values: [100] });

    expect(result.current).toEqual([100]);
  });

  it("starts a number at its target after the set empties and fills again", async () => {
    const { result, rerender } = renderSprung([100]);
    rerender({ values: [140] });
    await waitFor(() => expect(result.current).toEqual([140]));

    rerender({ values: [] });
    rerender({ values: [500] });

    expect(result.current).toEqual([500]);
  });

  it("carries a number on at its speed when it is sent somewhere new on its way", async () => {
    const { result, rerender, drawn } = renderDrawn([0]);
    rerender({ values: [100] });
    await waitFor(() => expect(result.current[0]).toBeGreaterThan(OUT_ON_ITS_WAY));
    const target = Math.round((result.current[0] ?? 0) + A_LITTLE_FURTHER);
    const sentAt = drawn.length;

    rerender({ values: [target] });
    await waitFor(() => expect(result.current).toEqual([target]), SETTLED);

    // Set off again from rest it would come to its new target without passing it; going at
    // the speed it had, it runs on past it before it comes back.
    expect(Math.max(...drawn.slice(sentAt))).toBeGreaterThan(target + 1);
  });

  it("keeps going as it was when only another number is sent somewhere new", async () => {
    const { result, rerender } = renderSprung([0, 0]);
    rerender({ values: [100, 0] });
    await waitFor(() => expect(result.current[0]).toBeGreaterThan(30));

    rerender({ values: [100, 50] });
    const [at] = result.current;
    await waitFor(() => expect(result.current[0]).toBeGreaterThan(at! + 10));
    await waitFor(() => expect(result.current).toEqual([100, 50]));
  });

  it("moves each number on the spring named for it", async () => {
    const { result, rerender } = renderHook(
      ({ values }) => useSprungAll(values, false, ["layout", "gentle"]),
      { initialProps: { values: [0, 0] } },
    );

    rerender({ values: [100, 100] });

    // Sent alike, the number on the gentle spring falls behind the one on layout.
    await waitFor(() => expect(result.current[0]).toBeGreaterThan(OUT_ON_ITS_WAY));
    expect(result.current[1]).toBeLessThan(result.current[0]!);
    await waitFor(() => expect(result.current).toEqual([100, 100]), SETTLED);
  });

  it("is the targets under reduced motion", () => {
    motionMock.isReduced = true;
    const { result, rerender } = renderSprung([100, 200]);

    rerender({ values: [140, 240] });

    expect(result.current).toEqual([140, 240]);
  });

  it("keeps a number's spring by its key when it moves up a place, and starts a new key at its target", async () => {
    const { result, rerender } = renderHook(
      ({ values, keys }) => useSprungAll(values, false, undefined, keys),
      { initialProps: { values: [100, 200] as number[], keys: ["old", "kept"] } },
    );

    // The old number leaves the first place, the kept one moves into it, a new one comes after.
    rerender({ values: [120, 260], keys: ["kept", "new"] });

    // The kept number sets off from where it stood, not from the old one's; the new one is
    // at its target.
    expect(result.current).toEqual([200, 260]);
    await waitFor(() => expect(result.current).toEqual([120, 260]), SETTLED);
  });

  it("goes no faster than over its reach, however far it is sent", async () => {
    const render = (reach: number | undefined) =>
      renderHook(({ values }) => useSprungAll(values, false, undefined, undefined, reach), {
        initialProps: { values: [0] as number[] },
      });
    const free = render(undefined);
    const reached = render(REACH_PX);
    free.rerender({ values: [100] });
    reached.rerender({ values: [100] });

    // By the layout spring's own time, the free number is nearly there; the one held to a
    // quarter of the way's reach is still well short.
    await new Promise((done) => setTimeout(done, LAYOUT_SETTLES_MS));
    expect(free.result.current[0]).toBeGreaterThan(NEARLY_THERE);
    expect(reached.result.current[0]).toBeLessThan(WELL_SHORT);
  });

  it("moves numbers sent together on one spring as one, however far each goes", async () => {
    const together = { type: "spring", visualDuration: 0.4, bounce: 0 } as const;
    const { result, rerender } = renderHook(
      ({ values }) =>
        useSprungAll(values, false, ["layout", "gentle"], undefined, REACH_PX, together),
      { initialProps: { values: [0, 0] as number[] } },
    );

    rerender({ values: [100, 300] });

    // Each is as far along its own way as the other, whatever its kind and reach.
    await waitFor(() => expect(result.current[0]).toBeGreaterThan(OUT_ON_ITS_WAY));
    expect(result.current[1]! / 300).toBeCloseTo(result.current[0]! / 100, 2);
    await waitFor(() => expect(result.current).toEqual([100, 300]), SETTLED);
  });
});

describe("useSprung", () => {
  it("starts from where it is told and springs to its target", async () => {
    const { result } = renderHook(() => useSprung(100, 40));

    expect(result.current).toBe(40);
    await waitFor(() => expect(result.current).toBe(100));
  });

  it("is its target at once with reduced motion", () => {
    motionMock.isReduced = true;
    const { result } = renderHook(() => useSprung(100, 40));

    expect(result.current).toBe(100);
  });
});
