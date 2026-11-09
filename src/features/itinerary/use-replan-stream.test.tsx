import { act, renderHook, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KYOTO_MORNING_BASIS, KYOTO_SLOW_MORNING } from "@/lib/fixtures/replan/kyoto-morning";
import { DAY_ID_HEADER } from "@/lib/days/stored-day";
import { mergeReplan } from "@/lib/replan/merge";
import { REPLAN_WHOLE_DAY_STATUS } from "@/lib/replan/request";
import { useReplanStream, type ReplanSource } from "./use-replan-stream";

const OUTCOME_WAIT = { timeout: 5000 };

/** The route's answer: the re-plan's text in deltas, then, when it ends whole, its finish. */
function streamOf(isWhole: boolean): Response {
  const text = JSON.stringify(KYOTO_SLOW_MORNING);
  const cut = isWhole ? text : text.slice(0, text.length / 2);
  const events: object[] = [{ type: "start" }, { type: "text-start", id: "t" }];
  for (let start = 0; start < cut.length; start += 200) {
    events.push({ type: "text-delta", id: "t", delta: cut.slice(start, start + 200) });
  }
  events.push(
    ...(isWhole
      ? [{ type: "text-end", id: "t" }, { type: "finish" }]
      : [{ type: "error", errorText: "Overloaded" }]),
  );
  const body = [...events.map((event) => JSON.stringify(event)), "[DONE]"]
    .map((line) => `data: ${line}\n\n`)
    .join("");
  return new Response(body);
}

function sourceOf(answer: () => Response): ReplanSource {
  return { basis: KYOTO_MORNING_BASIS, open: () => Promise.resolve(answer()) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useReplanStream", () => {
  it("reads a re-plan as it streams, and ends with the day it merged into", async () => {
    const { result } = renderHook(() => useReplanStream());

    act(() => result.current.play(sourceOf(() => streamOf(true))));

    expect(result.current.isStreaming).toBe(true);
    expect(result.current.basis).toBe(KYOTO_MORNING_BASIS);
    // Answered with its stream, the day's part may be struck through.
    await waitFor(() => expect(result.current.isAnswered).toBe(true), OUTCOME_WAIT);
    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
    const merged = mergeReplan({ ...KYOTO_MORNING_BASIS, replan: KYOTO_SLOW_MORNING });
    if (!merged.ok) throw new Error(merged.reason);
    expect(result.current.outcome).toEqual({ kind: "complete", itinerary: merged.itinerary });
    expect(result.current.partial).toEqual(KYOTO_SLOW_MORNING);
    expect(result.current.isStreaming).toBe(false);
  });

  it("names the merged day by the re-plan's id in the log, as its answer gives it", async () => {
    const id = "5d7c3b1e-2a4f-4c6d-8e9a-0b1c2d3e4f5a";
    const { result } = renderHook(() => useReplanStream());

    act(() =>
      result.current.play(
        sourceOf(() => {
          const answer = streamOf(true);
          const headers = new Headers(answer.headers);
          headers.set(DAY_ID_HEADER, id);
          return new Response(answer.body, { headers });
        }),
      ),
    );

    await waitFor(() => expect(result.current.dayId).toBe(id), OUTCOME_WAIT);
    await waitFor(() => expect(result.current.outcome?.kind).toBe("complete"), OUTCOME_WAIT);
  });

  it("lets a re-plan go when stopped, keeping the id its answer named, and ends none", async () => {
    const id = "5d7c3b1e-2a4f-4c6d-8e9a-0b1c2d3e4f5a";
    const signals: AbortSignal[] = [];
    const { result } = renderHook(() => useReplanStream());
    const held: ReplanSource = {
      basis: KYOTO_MORNING_BASIS,
      open: (opened) => {
        signals.push(opened);
        // Its answer names its row in the log, then its stream holds until it is let go.
        const body = new ReadableStream<Uint8Array>({
          start: (controller) =>
            opened.addEventListener("abort", () => controller.error(opened.reason)),
        });
        return Promise.resolve(new Response(body, { headers: { [DAY_ID_HEADER]: id } }));
      },
    };

    act(() => result.current.play(held));
    await waitFor(() => expect(result.current.dayId).toBe(id), OUTCOME_WAIT);
    act(() => result.current.stop());

    expect(signals.map((signal) => signal.aborted)).toEqual([true]);
    expect(result.current.isStreaming).toBe(false);
    // The visitor's days keep it by its id; the page shows no ending for it.
    expect(result.current.dayId).toBe(id);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.outcome).toBeNull();
  });

  it("keeps nothing of a re-plan cut short: the day stays as it was", async () => {
    const { result } = renderHook(() => useReplanStream());

    act(() => result.current.play(sourceOf(() => streamOf(false))));

    await waitFor(() => expect(result.current.outcome).not.toBeNull(), OUTCOME_WAIT);
    expect(result.current.outcome?.kind).not.toBe("complete");
  });

  it("says when the route sends the word on to the whole day, and ends no re-plan", async () => {
    const { result } = renderHook(() => useReplanStream());

    act(() =>
      result.current.play(sourceOf(() => new Response(null, { status: REPLAN_WHOLE_DAY_STATUS }))),
    );

    await waitFor(() => expect(result.current.isWholeDay).toBe(true), OUTCOME_WAIT);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.outcome).toBeNull();
    // Sent on, it never answered with a stream: nothing of the day was struck.
    expect(result.current.isAnswered).toBe(false);
  });

  it("throws a failure that is not the stream's to the nearest error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const caught: unknown[] = [];
    // A blank city never parsed: the merge normalizes the finished re-plan and throws.
    const unchecked: ReplanSource = {
      basis: { ...KYOTO_MORNING_BASIS, request: { ...KYOTO_MORNING_BASIS.request, city: " " } },
      open: () => Promise.resolve(streamOf(true)),
    };

    const { result } = renderHook(() => useReplanStream(), {
      wrapper: ({ children }) => (
        <Boundary onError={(error) => caught.push(error)}>{children}</Boundary>
      ),
    });
    act(() => result.current.play(unchecked));

    await waitFor(() => expect(caught).toHaveLength(1), OUTCOME_WAIT);
    expect(String(caught[0])).toMatch(/The normalizer built an invalid itinerary/);
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
