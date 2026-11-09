import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KYOTO_DAY } from "@/lib/fixtures/curated/kyoto";
import { useDayStream } from "./use-day-stream";

// The reader's chunk fails to load, as it does when the network drops after the page came.
vi.mock("@/lib/stream/read-day-stream", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

describe("useDayStream without its reader", () => {
  it("ends the day as a connection lost before anything arrived, and closes its stream", async () => {
    const signals: AbortSignal[] = [];
    const { result } = renderHook(() => useDayStream());

    act(() =>
      result.current.play({
        request: KYOTO_DAY.request,
        open: (signal) => {
          signals.push(signal);
          return Promise.resolve(new Response(null));
        },
      }),
    );

    await waitFor(() =>
      expect(result.current.outcome).toEqual({ kind: "disconnected", itinerary: null }),
    );
    expect(result.current).toMatchObject({ partial: null, isStreaming: false });
    expect(signals[0]?.aborted).toBe(true);
  });
});
