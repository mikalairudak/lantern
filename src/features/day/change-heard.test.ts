import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  changeLineOf,
  useChangeHeard,
  type DayAfterChange,
  type DayChange,
  type ShownPlace,
} from "./change-heard";

const PLACES: readonly ShownPlace[] = [
  { id: "coffee-hirosaka", name: "Coffee near Hirosaka" },
  { id: "oyama-shrine", name: "Oyama Shrine" },
];
/** The id of a place a stop showed before a swap took it to one of `PLACES`. */
const PLACE_BEFORE = "kenroku-garden";
const CLAUSE = "livelier at breakfast";
/** The day after a change, its clause and whether it is the plan as given. */
const dayAfter = (clause: string | null, isAsPlanned = false): DayAfterChange => ({
  clause,
  isAsPlanned,
  placeAt: (stopIndex) => PLACES[stopIndex] ?? null,
});
/** A swap at a stop, from the day as it stood: its clause, and whether it was the plan. */
const swapAt = (
  stopIndex: number,
  clauseBefore: string | null,
  wasAsPlanned = false,
  placeIdBefore = PLACE_BEFORE,
): DayChange => ({ kind: "stop", stopIndex, placeIdBefore, clauseBefore, wasAsPlanned });
/** A drag of the curve, from the day as it stood. */
const dragFrom = (clauseBefore: string | null, wasAsPlanned = false): DayChange => ({
  kind: "curve",
  clauseBefore,
  wasAsPlanned,
});

describe("changeLineOf", () => {
  it("says a swap as the place now standing and the clause it brought", () => {
    expect(changeLineOf(swapAt(0, null, true), dayAfter(CLAUSE))).toBe(
      `Coffee near Hirosaka, ${CLAUSE}`,
    );
  });

  it("says a swap's place alone where the clause stays as it was", () => {
    expect(changeLineOf(swapAt(1, CLAUSE), dayAfter(CLAUSE))).toBe("Oyama Shrine");
  });

  it("says a swap back to the plan as the place and the plan regained", () => {
    expect(changeLineOf(swapAt(0, CLAUSE), dayAfter(null, true))).toBe(
      "Coffee near Hirosaka, as first planned",
    );
  });

  it("says the plan regained where the swap leaves a day with no clause as it was", () => {
    expect(changeLineOf(swapAt(0, null), dayAfter(null, true))).toBe(
      "Coffee near Hirosaka, as first planned",
    );
  });

  it("says no plan regained where the clause goes but another stop still differs", () => {
    expect(changeLineOf(swapAt(0, CLAUSE), dayAfter(null, false))).toBe("Coffee near Hirosaka");
  });

  it("says nothing of an act that leaves the stop's place and the clause as they were", () => {
    expect(changeLineOf(swapAt(0, CLAUSE, false, PLACES[0]!.id), dayAfter(CLAUSE))).toBe("");
  });

  it("says a swap between two versions of one name, told apart by their ids", () => {
    // The place before shares the name of the place now standing, not its id.
    expect(changeLineOf(swapAt(0, CLAUSE, false, "coffee-hirosaka-2"), dayAfter(CLAUSE))).toBe(
      "Coffee near Hirosaka",
    );
  });

  it("says the clause alone where there is no place to name", () => {
    expect(changeLineOf(swapAt(PLACES.length, null), dayAfter(CLAUSE))).toBe(CLAUSE);
  });

  it("says a drag as the clause it changed, the plan regained, or nothing", () => {
    expect(changeLineOf(dragFrom(null), dayAfter("quieter in the afternoon"))).toBe(
      "quieter in the afternoon",
    );
    expect(changeLineOf(dragFrom("quieter in the afternoon"), dayAfter(null, true))).toBe(
      "as first planned",
    );
    expect(
      changeLineOf(dragFrom("quieter in the afternoon"), dayAfter("quieter in the afternoon")),
    ).toBe("");
    expect(changeLineOf(dragFrom("quieter in the afternoon"), dayAfter(null))).toBe("");
  });

  it("says no plan regained of a drag that leaves the day as planned", () => {
    expect(changeLineOf(dragFrom(null, true), dayAfter(null, true))).toBe("");
  });

  it("says an energy press in the words it was given", () => {
    expect(
      changeLineOf({ kind: "energy", line: "lively: four stops re-picked" }, dayAfter(null)),
    ).toBe("lively: four stops re-picked");
  });
});

describe("useChangeHeard", () => {
  const SWAP = swapAt(0, null, true);
  const SWAP_LINE = `Coffee near Hirosaka, ${CLAUSE}`;

  /** Hears changes on a day that starts as given and changes as the test rerenders it. */
  function hearOn(after: DayAfterChange) {
    return renderHook((props: { after: DayAfterChange }) => useChangeHeard(props.after), {
      initialProps: { after },
    });
  }

  /** Hears a swap that brings a clause, the day taking it in the act's own render. */
  async function hearSwap() {
    const hearing = hearOn(dayAfter(null));
    act(() => hearing.result.current.hear(SWAP));
    expect(hearing.result.current.line).toBe("");
    hearing.rerender({ after: dayAfter(CLAUSE) });
    await waitFor(() => expect(hearing.result.current.line).toBe(SWAP_LINE));
    return hearing;
  }

  it("empties at the act, then says it from the day as it stands a frame later", async () => {
    await hearSwap();
  });

  it("keeps the line as written when the day changes with no act", async () => {
    const { result, rerender } = await hearSwap();

    rerender({ after: dayAfter(null) });
    expect(result.current.line).toBe(SWAP_LINE);
  });

  it("empties when the line is dropped, and says nothing more", async () => {
    const { result, rerender } = await hearSwap();

    act(() => result.current.drop());
    rerender({ after: dayAfter(null) });
    expect(result.current.line).toBe("");
  });
});
