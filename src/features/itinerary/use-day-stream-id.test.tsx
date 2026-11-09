import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { MINIMAL_DAY } from "@/lib/fixtures/edge/edge-days";
import { simulateDayStream, type StreamPace } from "@/lib/stream/simulate-day-stream";
import { useDayStream, type DaySource } from "./use-day-stream";

/** Slow enough that the day's id arrives while its body still streams. */
const SLOW: Partial<StreamPace> = { deltaChars: 40, deltaDelayMs: 20 };
/** Room for a whole day to stream while coverage instruments the reader. */
const OUTCOME_WAIT = { timeout: 5000 };
const ID = "0b6c6f1e-3d2a-4e8b-9a51-6f0c2d7e4a19";

/** A source whose answer names the day's row in the log, as a live day's does. */
function namedSourceOf(id: string | null): DaySource {
  return {
    request: MINIMAL_DAY.request,
    open: async (signal) => {
      const answer = await simulateDayStream({
        day: MINIMAL_DAY.day,
        ending: { kind: "finished" },
        pace: SLOW,
        signal,
      });
      const headers = new Headers(answer.headers);
      if (id !== null) headers.set(DAY_ID_HEADER, id);
      return new Response(answer.body, { status: answer.status, headers });
    },
  };
}

describe("useDayStream, the day's id", () => {
  it("names a live day by its answer's id before its body has ended", async () => {
    const { result } = renderHook(() => useDayStream());

    act(() => result.current.play(namedSourceOf(ID)));

    await waitFor(() => expect(result.current.dayId).toBe(ID));
    expect(result.current.outcome).toBeNull();
  });

  it("names no day played from its file, nor one whose id is not one", async () => {
    const { result } = renderHook(() => useDayStream());

    for (const id of [null, "not-an-id"]) {
      act(() => result.current.play(namedSourceOf(id)));
      await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
      expect(result.current.dayId).toBeNull();
    }
  });

  it("forgets the last day's id when the next one plays", async () => {
    const { result } = renderHook(() => useDayStream());
    act(() => result.current.play(namedSourceOf(ID)));
    await waitFor(() => expect(result.current.dayId).toBe(ID));

    act(() => result.current.play(namedSourceOf(null)));

    expect(result.current.dayId).toBeNull();
  });
});
