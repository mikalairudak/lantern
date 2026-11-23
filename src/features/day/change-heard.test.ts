import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { changeLineOf, useChangeHeard, type DayAfterChange } from "./change-heard";

const PLACES = ["Coffee near Hirosaka", "Oyama Shrine"];
/** The day after a change, its clause and whether it is the plan as given. */
const dayAfter = (clause: string | null, isAsPlanned = false): DayAfterChange => ({
  clause,
  isAsPlanned,
  placeAt: (stopIndex) => PLACES[stopIndex] ?? "",
});

describe("changeLineOf", () => {
  it("says a swap as the place now standing and the clause it brought", () => {
    const swap = { kind: "stop", stopIndex: 0, clauseBefore: null } as const;
    expect(changeLineOf(swap, dayAfter("livelier at breakfast"))).toBe(
      "Coffee near Hirosaka, livelier at breakfast",
    );
  });

  it("says a swap's place alone where the clause stays as it was", () => {
    const swap = { kind: "stop", stopIndex: 1, clauseBefore: "livelier at breakfast" } as const;
    expect(changeLineOf(swap, dayAfter("livelier at breakfast"))).toBe("Oyama Shrine");
  });

  it("says a swap back to the plan as the place and the plan regained", () => {
    const swap = { kind: "stop", stopIndex: 0, clauseBefore: "livelier at breakfast" } as const;
    expect(changeLineOf(swap, dayAfter(null, true))).toBe("Coffee near Hirosaka, as first planned");
  });

  it("says no plan regained where the clause goes but another stop still differs", () => {
    const swap = { kind: "stop", stopIndex: 0, clauseBefore: "livelier at breakfast" } as const;
    expect(changeLineOf(swap, dayAfter(null, false))).toBe("Coffee near Hirosaka");
  });

  it("says a drag as the clause it changed, the plan regained, or nothing", () => {
    expect(
      changeLineOf({ kind: "curve", clauseBefore: null }, dayAfter("quieter in the afternoon")),
    ).toBe("quieter in the afternoon");
    expect(
      changeLineOf(
        { kind: "curve", clauseBefore: "quieter in the afternoon" },
        dayAfter(null, true),
      ),
    ).toBe("as first planned");
    expect(
      changeLineOf(
        { kind: "curve", clauseBefore: "quieter in the afternoon" },
        dayAfter("quieter in the afternoon"),
      ),
    ).toBe("");
    expect(
      changeLineOf({ kind: "curve", clauseBefore: "quieter in the afternoon" }, dayAfter(null)),
    ).toBe("");
  });

  it("says an energy press in the words it was given", () => {
    expect(
      changeLineOf({ kind: "energy", line: "lively: four stops re-picked" }, dayAfter(null)),
    ).toBe("lively: four stops re-picked");
  });
});

describe("useChangeHeard", () => {
  const SWAP = { kind: "stop", stopIndex: 0, clauseBefore: null } as const;
  const SWAP_LINE = "Coffee near Hirosaka, livelier at breakfast";

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
    hearing.rerender({ after: dayAfter("livelier at breakfast") });
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
