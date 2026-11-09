import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealDay, revealLength } from "./stand-in-stream";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { draftDayOf } from "@/features/abacus/day-draft";
import { ALICANTE_DEK, dekOf } from "./dek";
import type { Answer } from "./facts";
import { FAIL_AFTER_SECONDS } from "./recompose-stream";
import { generatedDayOf } from "./stream";
import { useRequest } from "./use-request";

const GENERATED = generatedDayOf(ABACUS_DAY);
const WRITTEN = draftDayOf(revealDay(GENERATED, revealLength(GENERATED)));
const FAMILY: Answer = { key: "company", value: "family" };
const MS_PER_SECOND = 1000;
/** Longer than any re-composition's stream. */
const STREAMED_MS = 15_000;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderRequest(isNextFailing = false) {
  const onFailingUsed = vi.fn();
  const view = renderHook(
    ({ isFailing }) =>
      useRequest({
        itinerary: ABACUS_DAY,
        draft: WRITTEN,
        isNextFailing: isFailing,
        onFailingUsed,
      }),
    { initialProps: { isFailing: isNextFailing } },
  );
  return { ...view, onFailingUsed };
}

const names = (stops: readonly { primary: { name?: string } }[]) =>
  stops.map((stop) => stop.primary.name);

describe("useRequest", () => {
  it("says how to change a word until the first change", () => {
    const { result } = renderRequest();

    expect(result.current.slot).toEqual({ kind: "hint" });

    act(() => result.current.answer({ key: "travel", value: "on-foot" }, {}));

    expect(result.current.slot).toBeNull();
  });

  it("confirms an assumption without re-composing anything", () => {
    const { result } = renderRequest();
    const before = result.current.day.stops;

    act(() => result.current.answer({ key: "travel", value: "on-foot" }, {}));

    expect(result.current.facts.travel.source).toBe("chosen");
    expect(result.current.isRecomposing).toBe(false);
    expect(names(result.current.day.stops)).toEqual(names(before));
  });

  it("re-composes only dinner for family, and says why it revised eating late", () => {
    const { result } = renderRequest();

    act(() => result.current.answer(FAMILY, {}));

    expect(result.current.isRecomposing).toBe(true);
    expect(result.current.facts.company).toMatchObject({ value: "family", source: "chosen" });
    expect(result.current.day.stops[7]?.primary.name).toBeUndefined();

    act(() => vi.advanceTimersByTime(STREAMED_MS));

    expect(result.current.isRecomposing).toBe(false);
    expect(names(result.current.day.stops)).toEqual([
      ...names(ABACUS_DAY.stops.slice(0, 7)),
      "Rice on Calle Mayor",
    ]);
    expect(result.current.facts.dinner).toMatchObject({ value: "early", revisedFrom: "late" });
    expect(result.current.slot).toMatchObject({
      kind: "reason",
      text: "an earlier dinner suits a family",
    });
  });

  it("keeps the day and reverts the word when the call fails, offering a retry", () => {
    const { result, rerender, onFailingUsed } = renderRequest(true);

    act(() => result.current.answer(FAMILY, {}));

    expect(onFailingUsed).toHaveBeenCalledOnce();
    expect(result.current.facts.company.value).toBe("family");

    act(() => vi.advanceTimersByTime(FAIL_AFTER_SECONDS * MS_PER_SECOND));

    expect(result.current.isRecomposing).toBe(false);
    expect(result.current.facts.company).toMatchObject({ value: null, source: "asked" });
    expect(names(result.current.day.stops)).toEqual(names(ABACUS_DAY.stops));
    expect(result.current.slot).toEqual({ kind: "error", answer: FAMILY, name: "family" });

    // The lab control goes back to "ok" once a failing call has started.
    rerender({ isFailing: false });
    act(() => result.current.answer(FAMILY, {}));
    act(() => vi.advanceTimersByTime(STREAMED_MS));

    expect(result.current.slot).toMatchObject({ kind: "reason" });
    expect(result.current.day.stops[7]?.primary.name).toBe("Rice on Calle Mayor");
  });

  it("keeps the headline, the line and the stops in agreement when a part is answered twice", () => {
    const { result } = renderRequest();

    act(() => result.current.answer(FAMILY, {}));
    act(() => vi.advanceTimersByTime(STREAMED_MS));
    act(() => result.current.answer({ key: "end", value: "late" }, {}));

    // At the click, the family's words write themselves back to the first day's.
    expect(result.current.facts.company).toMatchObject({ value: null, source: "asked" });
    expect(result.current.facts.dinner).toMatchObject({ value: "late", revisedFrom: null });

    act(() => vi.advanceTimersByTime(STREAMED_MS));

    expect(result.current.facts.end).toMatchObject({ value: "late", source: "chosen" });
    expect(result.current.day.stops[7]?.primary.name).toBe("El Barrio");
    expect(result.current.dek.fragments.evening).toMatch(/El Barrio until midnight$/);
  });

  it("rewrites only an answer's own fragment of the line, keeping the others", () => {
    const { result } = renderRequest();

    act(() => result.current.answer(FAMILY, {}));
    act(() => vi.advanceTimersByTime(STREAMED_MS));
    act(() => result.current.answer({ key: "travel", value: "transit" }, {}));

    expect(result.current.dek).toMatchObject({ part: "dusk", isComplete: true });
    expect(dekOf(result.current.dek.fragments)).toBe(
      dekOf({
        ...ALICANTE_DEK,
        evening: "a table for everyone in the old town at half past eight",
      }),
    );

    act(() => vi.advanceTimersByTime(STREAMED_MS));

    expect(dekOf(result.current.dek.fragments)).toBe(
      "Sunrise from the beach under the castle, the old town before it wakes, rice on the " +
        "marina, the tram up the coast to San Juan at dusk, and a table for everyone in the " +
        "old town at half past eight.",
    );
    expect(names(result.current.day.stops).slice(6)).toEqual([
      "Playa de San Juan",
      "Rice on Calle Mayor",
    ]);
  });

  it("holds room for the day on screen at rest, and for the answer's finished state from its click", () => {
    const { result } = renderRequest();

    expect(result.current.reserve).toHaveLength(1);
    expect(result.current.reserve[0]?.slot).toEqual({ kind: "hint" });

    act(() => result.current.answer(FAMILY, {}));

    const [finished, ...others] = result.current.reserve;
    expect(others).toEqual([]);
    expect(finished?.facts.dinner).toMatchObject({ value: "early", revisedFrom: "late" });
    expect(finished?.stops[7]?.primary.name).toBe("Rice on Calle Mayor");
    expect(finished?.deks).toEqual([
      ABACUS_DAY.dek,
      expect.stringMatching(/at half past eight\.$/),
    ]);
    expect(finished?.slot).toMatchObject({ kind: "reason" });
  });

  it("also holds room for the failure a failing call ends in", () => {
    const { result } = renderRequest(true);

    act(() => result.current.answer(FAMILY, {}));

    expect(result.current.reserve[1]).toMatchObject({
      facts: { company: { value: null } },
      slot: { kind: "error", name: "family" },
    });
  });

  it("re-plans every stop for a new energy word without a model call", () => {
    const { result } = renderRequest();
    const lively: Answer = { key: "energy", value: "lively" };

    const replanned = result.current.replanned(lively);
    act(() => result.current.answer(lively, {}));

    expect(result.current.isRecomposing).toBe(false);
    expect(result.current.energy).toBe(3);
    expect(result.current.day.stops.map((stop) => stop.selectedPlaceId)).toEqual(
      replanned?.map((stop) => stop.selectedPlaceId),
    );
  });
});
