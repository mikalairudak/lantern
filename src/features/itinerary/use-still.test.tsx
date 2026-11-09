import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAILED_NOTE, READING_NOTE, StillNote, useStill } from "./use-still";

/** A promise that rejects once a test has nothing else to do, as a still that fails. */
function failing(reason: unknown): Promise<string> {
  const still = Promise.reject(reason);
  // Read by the hook; marked handled so the runner does not report it before then.
  still.catch(() => undefined);
  return still;
}

describe("useStill", () => {
  it("reads a cell's still, saying it is reading until then", async () => {
    // One promise for every render, as an example module's cache gives.
    const still = Promise.resolve("Kyoto at noon");
    const { result } = renderHook(() => useStill(still));

    expect(result.current).toEqual({ status: "reading" });
    await waitFor(() => expect(result.current).toEqual({ status: "read", still: "Kyoto at noon" }));
  });

  it("says why a still failed to read, rather than reading for good", async () => {
    const still = failing(new Error("A day does not normalize"));
    const { result } = renderHook(() => useStill(still));

    await waitFor(() =>
      expect(result.current).toEqual({ status: "failed", reason: "A day does not normalize" }),
    );
  });

  it("says what a still that is not an error failed with", async () => {
    const still = failing("no stream");
    const { result } = renderHook(() => useStill(still));

    await waitFor(() => expect(result.current).toEqual({ status: "failed", reason: "no stream" }));
  });

  it("reads another still afresh, never showing the last one's", async () => {
    const kyoto = Promise.resolve("Kyoto");
    const { result, rerender } = renderHook(({ still }) => useStill(still), {
      initialProps: { still: kyoto },
    });
    await waitFor(() => expect(result.current).toEqual({ status: "read", still: "Kyoto" }));

    const lisbon = Promise.withResolvers<string>();
    rerender({ still: lisbon.promise });
    expect(result.current).toEqual({ status: "reading" });

    lisbon.resolve("Lisbon");
    await waitFor(() => expect(result.current).toEqual({ status: "read", still: "Lisbon" }));
  });
});

describe("StillNote", () => {
  it("says the day is being read", () => {
    render(<StillNote reading={{ status: "reading" }} />);

    expect(screen.getByText(READING_NOTE)).toHaveClass("text-small", "text-muted");
  });

  it("says why the day's frames could not be read, in the same muted text", () => {
    render(<StillNote reading={{ status: "failed", reason: "A day does not normalize" }} />);

    expect(screen.getByText(`${FAILED_NOTE} A day does not normalize`)).toHaveClass(
      "text-small",
      "text-muted",
    );
    expect(screen.queryByText(READING_NOTE)).not.toBeInTheDocument();
  });
});
