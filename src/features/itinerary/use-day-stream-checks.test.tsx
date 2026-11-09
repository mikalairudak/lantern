import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MINIMAL_DAY } from "@/lib/fixtures/edge/edge-days";
import { PLACE_CHECK_PART, type PlaceCheck } from "@/lib/stream/place-checks";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { NO_CHECKS, useDayStream, type DaySource } from "./use-day-stream";

const TEXT = dayText(MINIMAL_DAY.day);
const DELTA_CHARS = 200;
const OUTCOME_WAIT = { timeout: 5000 };

const CHECKING: PlaceCheck = { placeId: "stop-0:p", state: "checking" };
const CONFIRMED: PlaceCheck = {
  placeId: "stop-0:p",
  state: "confirmed",
  by: "name",
  coordinates: { lat: 38.3462, lng: -0.4779 },
};

/** A live answer: the day's text in deltas, each place's checks beside it, then the finish. */
function answerWith(checks: readonly PlaceCheck[]): DaySource {
  const deltas: object[] = [{ type: "start" }, { type: "text-start", id: "t" }];
  for (let start = 0; start < TEXT.length; start += DELTA_CHARS) {
    deltas.push({ type: "text-delta", id: "t", delta: TEXT.slice(start, start + DELTA_CHARS) });
  }
  const parts = checks.map((check) => ({ type: PLACE_CHECK_PART, id: check.placeId, data: check }));
  const events = [...deltas, ...parts, { type: "text-end", id: "t" }, { type: "finish" }];
  const body = [...events.map((event) => JSON.stringify(event)), "[DONE]"]
    .map((line) => `data: ${line}\n\n`)
    .join("");
  return {
    request: MINIMAL_DAY.request,
    open: () => Promise.resolve(new Response(body)),
  };
}

describe("useDayStream, each place's check", () => {
  it("takes each place's last check as the answer carries it, by the place's id", async () => {
    const { result } = renderHook(() => useDayStream());

    act(() => result.current.play(answerWith([CHECKING, CONFIRMED])));

    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
    expect(result.current.checks).toEqual({ "stop-0:p": CONFIRMED });
  });

  it("forgets the last day's checks when the next one plays", async () => {
    const { result } = renderHook(() => useDayStream());
    act(() => result.current.play(answerWith([CONFIRMED])));
    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);

    act(() => result.current.play(answerWith([])));

    expect(result.current.checks).toBe(NO_CHECKS);
    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
    expect(result.current.checks).toEqual({});
  });
});
