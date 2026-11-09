import { act, renderHook, waitFor } from "@testing-library/react";
import { Component, StrictMode, useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { MINIMAL_DAY, REFUSED_DAY } from "@/lib/fixtures/edge/edge-days";
import type { DayRequest, GeneratedDay } from "@/lib/schema/itinerary.schema";
import {
  simulateDayStream,
  type StreamEnding,
  type StreamPace,
} from "@/lib/stream/simulate-day-stream";
import { useDayStream, type DaySource, type DayStream } from "./use-day-stream";

/** Slow enough that a test can act while the day is still streaming. */
const SLOW: Partial<StreamPace> = { deltaChars: 40, deltaDelayMs: 20 };
/** A short day at a few frames' pace, so partials land before the outcome. */
const PACED: Partial<StreamPace> = { deltaChars: 20, deltaDelayMs: 5 };
/** Room for a whole day to stream while coverage instruments the reader. */
const OUTCOME_WAIT = { timeout: 5000 };
/** Inside the stops: the day has begun, but no swap has arrived. */
const BEFORE_THE_SWAPS = 2000;

interface Played {
  request: DayRequest;
  day: GeneratedDay;
}

function sourceOf(
  { request, day }: Played,
  ending: StreamEnding = { kind: "finished" },
  pace?: Partial<StreamPace>,
): DaySource {
  return { request, open: (signal) => simulateDayStream({ day, ending, pace, signal }) };
}

/** Every state the hook rendered, oldest first. */
function renderStream() {
  const seen: DayStream[] = [];
  const view = renderHook(() => {
    const stream = useDayStream();
    seen.push(stream);
    return stream;
  });
  return { ...view, seen };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const FINISHED: StreamEnding = { kind: "finished" };
/** Kyoto's day as the model wrote it: its stops closed with none in them. */
const EMPTY = sourceOf(
  { ...KYOTO_DAY, day: { ...KYOTO_DAY.day, stops: [], alternatives: [] } },
  FINISHED,
  PACED,
);

/**
 * One request whose every opening is answered by the next source, the last one again past
 * the end, with the signal each opening was given.
 */
function answeredInTurn(answers: readonly DaySource[]) {
  const signals: AbortSignal[] = [];
  const source: DaySource = {
    request: KYOTO_DAY.request,
    open: (signal) => {
      signals.push(signal);
      const answer = answers[Math.min(signals.length, answers.length) - 1];
      if (answer === undefined) throw new Error("Nothing answers the day");
      return answer.open(signal);
    },
  };
  return { source, signals };
}

describe("useDayStream", () => {
  it("starts with nothing and streams nothing", () => {
    const { result } = renderStream();

    expect(result.current).toMatchObject({
      request: null,
      partial: null,
      outcome: null,
      isStreaming: false,
    });
  });

  it("holds the request from the moment a day starts, before anything arrives", () => {
    const { result } = renderStream();

    act(() => result.current.play(sourceOf(KYOTO_DAY, { kind: "finished" }, SLOW)));

    expect(result.current).toMatchObject({ request: KYOTO_DAY.request, partial: null });
  });

  it("plays a day to its outcome and keeps the last partial", async () => {
    const { result } = renderStream();

    act(() => result.current.play(sourceOf(MINIMAL_DAY)));
    expect(result.current.isStreaming).toBe(true);

    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.partial?.stops).toHaveLength(MINIMAL_DAY.day.stops.length);
  });

  it("shows partials while the day streams, at most one a frame", async () => {
    const { result, seen } = renderStream();

    act(() => result.current.play(sourceOf(MINIMAL_DAY, { kind: "finished" }, PACED)));
    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);

    const streaming = seen.filter((state) => state.isStreaming && state.partial !== null);
    const deltas = Math.ceil(JSON.stringify(MINIMAL_DAY.day).length / (PACED.deltaChars ?? 1));
    expect(streaming.length).toBeGreaterThan(0);
    expect(seen.length).toBeLessThan(deltas);
  });

  it("clears the partial after a refusal", async () => {
    const { result } = renderStream();

    act(() => result.current.play(sourceOf(KYOTO_DAY, { kind: "refused", at: BEFORE_THE_SWAPS })));

    await waitFor(() => expect(result.current.outcome?.kind).toBe("refused"), OUTCOME_WAIT);
    expect(result.current.partial).toBeNull();
  });

  it("keeps what arrived when a stream is cut before the swaps", async () => {
    const { result } = renderStream();

    act(() =>
      result.current.play(sourceOf(KYOTO_DAY, { kind: "cut", at: BEFORE_THE_SWAPS, by: "length" })),
    );

    await waitFor(
      () => expect(result.current.outcome).toEqual({ kind: "cut", itinerary: null }),
      OUTCOME_WAIT,
    );
    expect(result.current.partial?.stops?.length).toBeGreaterThan(0);
  });

  it("reads a source that never connects as a lost connection", async () => {
    const { result } = renderStream();

    act(() => result.current.play(sourceOf(KYOTO_DAY, { kind: "offline" })));

    await waitFor(() =>
      expect(result.current.outcome).toEqual({ kind: "disconnected", itinerary: null }),
    );
  });

  it("gives the page to the day played last", async () => {
    const { result } = renderStream();

    act(() => result.current.play(sourceOf(KYOTO_DAY, { kind: "finished" }, SLOW)));
    act(() => result.current.play(sourceOf(MINIMAL_DAY)));

    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
    const outcome = result.current.outcome;
    expect(outcome?.kind === "complete" && outcome.itinerary.city).toBe("Hong Kong");
  });

  it("stops a day without an outcome, and stops reading it", async () => {
    const signals: AbortSignal[] = [];
    const { result } = renderStream();
    const source = sourceOf(KYOTO_DAY, { kind: "finished" }, SLOW);

    act(() =>
      result.current.play({
        ...source,
        open: (signal) => {
          signals.push(signal);
          return source.open(signal);
        },
      }),
    );
    await waitFor(() => expect(signals).toHaveLength(1));
    act(() => result.current.stop());

    expect(result.current).toMatchObject({ outcome: null, isStreaming: false });
    expect(signals[0]?.aborted).toBe(true);
  });

  it("stops reading when the page goes", async () => {
    const signals: AbortSignal[] = [];
    const { result, unmount } = renderStream();
    const source = sourceOf(KYOTO_DAY, { kind: "finished" }, SLOW);

    act(() =>
      result.current.play({
        ...source,
        open: (signal) => {
          signals.push(signal);
          return source.open(signal);
        },
      }),
    );
    await waitFor(() => expect(signals).toHaveLength(1));
    unmount();

    expect(signals[0]?.aborted).toBe(true);
  });

  it("never opens a day stopped in the task that played it", async () => {
    const open = vi.fn(sourceOf(KYOTO_DAY).open);
    const { result } = renderStream();

    act(() => {
      result.current.play({ request: KYOTO_DAY.request, open });
      result.current.stop();
    });
    await act(() => Promise.resolve());

    expect(open).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ outcome: null, isStreaming: false });
  });

  it("opens a day played on mount once under Strict Mode, and plays it to its end", async () => {
    const open = vi.fn(sourceOf(MINIMAL_DAY).open);
    const { result } = renderHook(
      () => {
        const stream = useDayStream();
        const { play } = stream;
        // As the day page plays the day it lands on.
        useEffect(() => play({ request: MINIMAL_DAY.request, open }), [play]);
        return stream;
      },
      { wrapper: StrictMode },
    );

    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
    expect(open).toHaveBeenCalledOnce();
  });

  it("throws a failure that is not the stream's to the nearest error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const caught: unknown[] = [];
    // A blank city never parsed: the normalizer finds it on the finished day and throws.
    const unchecked = { ...MINIMAL_DAY, request: { ...MINIMAL_DAY.request, city: " " } };

    const { result } = renderHook(() => useDayStream(), {
      wrapper: ({ children }) => (
        <Boundary onError={(error) => caught.push(error)}>{children}</Boundary>
      ),
    });
    act(() => result.current.play(sourceOf(unchecked)));

    await waitFor(() => expect(caught).toHaveLength(1), OUTCOME_WAIT);
    expect(String(caught[0])).toMatch(/The normalizer built an invalid itinerary/);
  });
});

// `docs/decisions.md`, "A day has at least one stop".
describe("useDayStream, a day that came back empty", () => {
  it("asks for it once more, from nothing, and shows the second's ending alone", async () => {
    const { result, seen } = renderStream();
    const { source, signals } = answeredInTurn([EMPTY, sourceOf(MINIMAL_DAY, FINISHED, PACED)]);

    act(() => result.current.play(source));

    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
    expect(signals).toHaveLength(2);
    expect(result.current.attempt).toBe(1);
    // The empty day was never an ending, and the retry started from nothing, still streaming.
    expect(seen.every((state) => state.outcome === null || state.outcome.kind === "complete")).toBe(
      true,
    );
    const retrying = seen.find((state) => state.attempt === 1);
    expect(retrying).toMatchObject({ partial: null, outcome: null, isStreaming: true });
    // What the empty day had written stays in hand, for the page to hold meanwhile.
    expect(retrying?.held).toMatchObject({ dek: KYOTO_DAY.day.dek, stops: [] });
  });

  it("shows a second empty day's ending, asking no third time", async () => {
    const { result } = renderStream();
    const { source, signals } = answeredInTurn([EMPTY]);

    act(() => result.current.play(source));

    await waitFor(() => expect(result.current.outcome?.kind).toBe("invalid"), OUTCOME_WAIT);
    expect(result.current.outcome).toMatchObject({ isEmpty: true });
    expect(signals).toHaveLength(2);
  });

  it.each<[string, DaySource]>([
    ["our limit", sourceOf(KYOTO_DAY, { kind: "limited" })],
    ["a refusal", sourceOf(KYOTO_DAY, { kind: "refused", at: BEFORE_THE_SWAPS })],
    ["a cut", sourceOf(KYOTO_DAY, { kind: "cut", at: BEFORE_THE_SWAPS, by: "length" })],
    ["a day invalid for another reason", sourceOf(REFUSED_DAY)],
  ])("asks no second time after %s", async (_name, answer) => {
    const { result } = renderStream();
    const { source, signals } = answeredInTurn([answer]);

    act(() => result.current.play(source));

    await waitFor(() => expect(result.current.outcome).not.toBeNull(), OUTCOME_WAIT);
    expect(signals).toHaveLength(1);
    expect(result.current.attempt).toBe(0);
  });

  it("starts the next day played at its first time", async () => {
    const { result } = renderStream();
    const { source } = answeredInTurn([EMPTY, sourceOf(MINIMAL_DAY)]);
    act(() => result.current.play(source));
    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);

    act(() => result.current.play(sourceOf(MINIMAL_DAY, FINISHED, SLOW)));

    expect(result.current).toMatchObject({
      attempt: 0,
      held: null,
      outcome: null,
      isStreaming: true,
    });
  });

  it("stops a day while it is asked for again, opening it no third time", async () => {
    const { result } = renderStream();
    const { source, signals } = answeredInTurn([EMPTY, sourceOf(KYOTO_DAY, FINISHED, SLOW)]);

    act(() => result.current.play(source));
    await waitFor(() => expect(signals).toHaveLength(2), OUTCOME_WAIT);
    act(() => result.current.stop());

    expect(result.current).toMatchObject({ outcome: null, isStreaming: false });
    expect(signals[1]?.aborted).toBe(true);
    expect(signals).toHaveLength(2);
  });
});

interface BoundaryProps {
  onError: (error: unknown) => void;
  children: ReactNode;
}

class Boundary extends Component<BoundaryProps, { hasFailed: boolean }> {
  override state = { hasFailed: false };

  static getDerivedStateFromError(): { hasFailed: boolean } {
    return { hasFailed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.hasFailed ? null : this.props.children;
  }
}
