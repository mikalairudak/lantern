import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ABACUS_DAY } from "@/lib/fixtures/hand-made/abacus-candidates";
import { candidatesOf } from "@/features/abacus/curve";
import type { StopDraft } from "@/features/abacus/day-draft";
import { seenKeyOf } from "./seen-days";
import { PICKED_PLACES_KEY, keepPickedPlaces, readPickedPlaces } from "./picked-places";
import { usePickedPlaces, type PickedPlacesOptions } from "./use-picked-places";

const STOPS: readonly StopDraft[] = ABACUS_DAY.stops;
const LUNCH = 4;
const LUNCH_ID = STOPS[LUNCH]!.id;
const ARROZ = candidatesOf(STOPS[LUNCH]!)[1]!.id;
const WRITTEN = STOPS.map(() => 0);
const KYOTO = seenKeyOf("kyoto", "0123456789abcdef");

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function render(options: Partial<PickedPlacesOptions> = {}) {
  const restore = vi.fn();
  const props: PickedPlacesOptions = {
    day: KYOTO,
    written: STOPS,
    stops: STOPS,
    committed: WRITTEN,
    restore,
    isWhole: true,
    isInteractive: true,
    ...options,
  };
  const hook = renderHook((given: PickedPlacesOptions) => usePickedPlaces(given), {
    initialProps: props,
  });
  return { ...hook, props, restore };
}

/** What the day shows with lunch at Arroz a banda. */
function withArroz(): number[] {
  return STOPS.map((_, index) => (index === LUNCH ? 1 : 0));
}

describe("usePickedPlaces", () => {
  it("shows the places kept for the day once it is whole", () => {
    keepPickedPlaces(localStorage, KYOTO, { [LUNCH_ID]: ARROZ });
    const { rerender, props, restore } = render({ isWhole: false, isInteractive: false });
    expect(restore).not.toHaveBeenCalled();

    rerender({ ...props, isWhole: true });
    expect(restore).toHaveBeenCalledExactlyOnceWith({ [LUNCH_ID]: ARROZ });
  });

  it("lets go a place kept for a stop the day no longer has, or that is none of its versions", () => {
    keepPickedPlaces(localStorage, KYOTO, { gone: "gone:a1", [LUNCH_ID]: "another-place" });
    const { restore } = render();

    expect(restore).not.toHaveBeenCalled();
    // What it shows is kept in their place: the written day, so nothing.
    expect(localStorage.getItem(PICKED_PLACES_KEY)).toBeNull();
  });

  it("reads nothing kept for another version of the day", () => {
    keepPickedPlaces(localStorage, seenKeyOf("kyoto", "fedcba9876543210"), {
      [LUNCH_ID]: ARROZ,
    });
    const { restore } = render();

    expect(restore).not.toHaveBeenCalled();
  });

  it("keeps what the visitor chose once the day rests under their hand, and lets it go when back to the plan", () => {
    const { rerender, props } = render();

    rerender({ ...props, committed: withArroz() });
    expect(readPickedPlaces(localStorage, KYOTO)).toEqual({ [LUNCH_ID]: ARROZ });

    rerender({ ...props, committed: WRITTEN });
    expect(localStorage.getItem(PICKED_PLACES_KEY)).toBeNull();
  });

  it("keeps nothing while the day cannot be changed, as while it is written or re-planned", () => {
    const { rerender, props } = render({ isInteractive: false });

    rerender({ ...props, isInteractive: false, committed: withArroz() });
    expect(localStorage.getItem(PICKED_PLACES_KEY)).toBeNull();
  });

  it("never puts what was kept over a place the visitor already chose", () => {
    keepPickedPlaces(localStorage, KYOTO, { [STOPS[1]!.id]: candidatesOf(STOPS[1]!)[1]!.id });
    const { restore } = render({ committed: withArroz() });

    expect(restore).not.toHaveBeenCalled();
    expect(readPickedPlaces(localStorage, KYOTO)).toEqual({ [LUNCH_ID]: ARROZ });
  });

  it("reads once: a key the day takes later keeps what the page shows", () => {
    const merged = "kept:merged-day";
    keepPickedPlaces(localStorage, merged, { [STOPS[1]!.id]: candidatesOf(STOPS[1]!)[1]!.id });
    const { rerender, props, restore } = render();

    rerender({ ...props, day: merged, committed: withArroz() });
    expect(restore).not.toHaveBeenCalled();
    expect(readPickedPlaces(localStorage, merged)).toEqual({ [LUNCH_ID]: ARROZ });
  });

  it("keeps the places on the page alone for a day with no key", () => {
    const { rerender, props, restore } = render({ day: null });

    rerender({ ...props, day: null, committed: withArroz() });
    expect(restore).not.toHaveBeenCalled();
    expect(localStorage.getItem(PICKED_PLACES_KEY)).toBeNull();
  });

  it("breaks nothing without storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { rerender, props, restore } = render();

    expect(() => rerender({ ...props, committed: withArroz() })).not.toThrow();
    expect(restore).not.toHaveBeenCalled();
  });
});
