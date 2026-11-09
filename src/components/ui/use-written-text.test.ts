import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWrittenText } from "./use-written-text";

const motion = vi.hoisted(() => ({ isReducedMotion: false }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motion.isReducedMotion };
});

afterEach(() => {
  motion.isReducedMotion = false;
});

/** Two `gentle` springs, one out and one in, settle well within this. */
const SPRINGS_TIMEOUT = { timeout: 3000 };

const LIVELIER = ", livelier at lunch,";
const QUIETER = ", quieter at lunch,";

/** Longer than a `gentle` spring takes to write a few letters, if it were let to. */
const HELD_MS = 400;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface WritingProps {
  target: string;
  isHeld: boolean;
  isStill?: boolean;
}

/** Renders the hook and keeps every text it puts on screen. */
function renderWriting(initial: string) {
  const seen: string[] = [];
  const initialProps: WritingProps = { target: initial, isHeld: false };
  const view = renderHook(
    ({ target, isHeld, isStill = false }: WritingProps) => {
      const written = useWrittenText(target, "keep", isHeld, isStill);
      seen.push(written.text);
      return written;
    },
    { initialProps },
  );
  return { ...view, seen };
}

describe("useWrittenText", () => {
  it("shows the text it starts with as already written", () => {
    const { result } = renderWriting(LIVELIER);

    expect(result.current).toEqual({ text: LIVELIER, isWriting: false });
  });

  it("writes a new text in from its first character", async () => {
    const { result, rerender, seen } = renderWriting("");

    rerender({ target: LIVELIER, isHeld: false });

    expect(result.current.isWriting).toBe(true);
    await waitFor(
      () => expect(result.current).toEqual({ text: LIVELIER, isWriting: false }),
      SPRINGS_TIMEOUT,
    );
    const lengths = seen.map((text) => text.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(seen.every((text) => LIVELIER.startsWith(text))).toBe(true);
  });

  it("unwrites to what the two texts share before writing the new one", async () => {
    const { result, rerender, seen } = renderWriting(LIVELIER);

    rerender({ target: QUIETER, isHeld: false });

    await waitFor(
      () => expect(result.current).toEqual({ text: QUIETER, isWriting: false }),
      SPRINGS_TIMEOUT,
    );
    expect(seen).toContain(", ");
    expect(seen.every((text) => LIVELIER.startsWith(text) || QUIETER.startsWith(text))).toBe(true);
  });

  it("keeps only the whole words two texts share, so the new one is written from its first different word", async () => {
    const seen: string[] = [];
    const { result, rerender } = renderHook(
      ({ target }: { target: string }) => {
        const written = useWrittenText(target, "words");
        seen.push(written.text);
        return written;
      },
      { initialProps: { target: "the walk, a set lunch" } },
    );

    rerender({ target: "the walk, arròs by the river" });

    await waitFor(
      () =>
        expect(result.current).toEqual({ text: "the walk, arròs by the river", isWriting: false }),
      SPRINGS_TIMEOUT,
    );
    // Unwritten to the end of "walk, ", past the "a" the two lines also share, where the
    // pen that keeps every shared letter would stop.
    expect(seen).toContain("the walk, ");
  });

  it("unwrites a text to nothing", async () => {
    const { result, rerender } = renderWriting(LIVELIER);

    rerender({ target: "", isHeld: false });

    await waitFor(
      () => expect(result.current).toEqual({ text: "", isWriting: false }),
      SPRINGS_TIMEOUT,
    );
  });

  it("writes nothing new while held, then writes on once released", async () => {
    const { result, rerender } = renderWriting("");

    rerender({ target: LIVELIER, isHeld: true });
    await wait(HELD_MS);

    expect(result.current).toEqual({ text: "", isWriting: true });

    rerender({ target: LIVELIER, isHeld: false });

    await waitFor(
      () => expect(result.current).toEqual({ text: LIVELIER, isWriting: false }),
      SPRINGS_TIMEOUT,
    );
  });

  it("stops where it is when held mid-word, and goes on from there", async () => {
    const { result, rerender, seen } = renderWriting("");

    rerender({ target: LIVELIER, isHeld: false });
    await waitFor(() => expect(result.current.text.length).toBeGreaterThan(2), SPRINGS_TIMEOUT);
    rerender({ target: LIVELIER, isHeld: true });
    const held = result.current.text;
    await wait(HELD_MS);

    expect(result.current.text).toBe(held);
    expect(held.length).toBeLessThan(LIVELIER.length);

    rerender({ target: LIVELIER, isHeld: false });

    await waitFor(
      () => expect(result.current).toEqual({ text: LIVELIER, isWriting: false }),
      SPRINGS_TIMEOUT,
    );
    const lengths = seen.map((text) => text.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });

  it("stops where it is while still, unwriting too, and goes on once let go", async () => {
    const { result, rerender } = renderWriting(LIVELIER);

    rerender({ target: "", isHeld: false });
    await waitFor(
      () => expect(result.current.text.length).toBeLessThan(LIVELIER.length - 2),
      SPRINGS_TIMEOUT,
    );
    rerender({ target: "", isHeld: false, isStill: true });
    const still = result.current.text;
    await wait(HELD_MS);

    expect(result.current.text).toBe(still);
    expect(still.length).toBeGreaterThan(0);

    rerender({ target: "", isHeld: false, isStill: false });

    await waitFor(
      () => expect(result.current).toEqual({ text: "", isWriting: false }),
      SPRINGS_TIMEOUT,
    );
  });

  it("goes on unwriting while held, since that needs no room", async () => {
    const { result, rerender } = renderWriting(LIVELIER);

    rerender({ target: "", isHeld: true });

    await waitFor(
      () => expect(result.current).toEqual({ text: "", isWriting: false }),
      SPRINGS_TIMEOUT,
    );
  });

  it("shows a new text at once with reduced motion", () => {
    motion.isReducedMotion = true;
    const { result, rerender } = renderWriting("");

    rerender({ target: LIVELIER, isHeld: false });

    expect(result.current).toEqual({ text: LIVELIER, isWriting: false });
  });

  it("swaps at once when told, and writes on from there as before", async () => {
    const seen: string[] = [];
    const { result, rerender } = renderHook(
      ({ target, mode }: { target: string; mode: "keep" | "instant" }) => {
        const written = useWrittenText(target, mode);
        seen.push(written.text);
        return written;
      },
      { initialProps: { target: LIVELIER, mode: "keep" as "keep" | "instant" } },
    );

    rerender({ target: QUIETER, mode: "instant" });
    expect(result.current).toEqual({ text: QUIETER, isWriting: false });
    rerender({ target: "", mode: "instant" });
    expect(result.current).toEqual({ text: "", isWriting: false });
    // No letter of either was unwritten on the way.
    expect(seen.every((text) => [LIVELIER, QUIETER, ""].includes(text))).toBe(true);
    const swapped = seen.length;

    // Back to the pen, it writes the next text from what is on screen: nothing.
    rerender({ target: LIVELIER, mode: "keep" });
    await waitFor(
      () => expect(result.current).toEqual({ text: LIVELIER, isWriting: false }),
      SPRINGS_TIMEOUT,
    );
    const written = seen.slice(swapped);
    expect(written.every((text) => LIVELIER.startsWith(text))).toBe(true);
    expect(written.some((text) => text.length > 0 && text.length < LIVELIER.length)).toBe(true);
  });
});

interface FadingProps {
  target: string;
  isHeld: boolean;
  isStill?: boolean;
}

/** Renders the hook in a mode for words the page knows, and keeps every text it shows. */
function renderFading(initial: string, mode: "fade" | "fade-held") {
  const seen: string[] = [];
  const initialProps: FadingProps = { target: initial, isHeld: false };
  const view = renderHook(
    ({ target, isHeld, isStill = false }: FadingProps) => {
      const written = useWrittenText(target, mode, isHeld, isStill);
      seen.push(written.text);
      return written;
    },
    { initialProps },
  );
  return { ...view, seen };
}

describe("useWrittenText, for words the page already knows", () => {
  it("fade: shows each new text whole in the render that sets it, never a part of one", () => {
    const { result, rerender, seen } = renderFading("", "fade");

    rerender({ target: LIVELIER, isHeld: false });
    expect(result.current).toEqual({ text: LIVELIER, isWriting: false });
    rerender({ target: QUIETER, isHeld: false });
    expect(result.current).toEqual({ text: QUIETER, isWriting: false });
    rerender({ target: "", isHeld: false });
    expect(result.current).toEqual({ text: "", isWriting: false });

    expect(seen.every((text) => ["", LIVELIER, QUIETER].includes(text))).toBe(true);
  });

  it("fade-held: shows a new text whole a frame after it is set, never a part of it", async () => {
    const { result, rerender, seen } = renderFading("", "fade-held");

    rerender({ target: LIVELIER, isHeld: false });
    // Not in the commit that sets it: the row it opens measures it there first.
    expect(result.current).toEqual({ text: "", isWriting: true });
    await waitFor(() => expect(result.current).toEqual({ text: LIVELIER, isWriting: false }));

    expect(seen.every((text) => ["", LIVELIER].includes(text))).toBe(true);
  });

  it("fade-held: waits while its row glides, though the glide began after the text was set, then shows it a frame after", async () => {
    const { result, rerender } = renderFading("", "fade-held");

    rerender({ target: LIVELIER, isHeld: false });
    // The row says it glides in the next commit, before the frame comes.
    rerender({ target: LIVELIER, isHeld: true });
    await wait(HELD_MS);
    expect(result.current).toEqual({ text: "", isWriting: true });

    rerender({ target: LIVELIER, isHeld: false });
    expect(result.current.text).toBe("");
    await waitFor(() => expect(result.current).toEqual({ text: LIVELIER, isWriting: false }));
  });

  it("fade-held: lets a text go at once, or end shorter, held or not, since that opens nothing", () => {
    const { result, rerender } = renderFading(LIVELIER, "fade-held");

    rerender({ target: ", livelier", isHeld: true });
    expect(result.current).toEqual({ text: ", livelier", isWriting: false });
    rerender({ target: "", isHeld: true });
    expect(result.current).toEqual({ text: "", isWriting: false });
  });

  it("fade-held: stands whole at rest, held or still, the same text set again changing nothing", async () => {
    const { result, rerender, seen } = renderFading(LIVELIER, "fade-held");

    rerender({ target: LIVELIER, isHeld: true });
    rerender({ target: LIVELIER, isHeld: false, isStill: true });
    rerender({ target: LIVELIER, isHeld: false });
    await wait(HELD_MS);

    expect(result.current).toEqual({ text: LIVELIER, isWriting: false });
    expect(seen.every((text) => text === LIVELIER)).toBe(true);
  });

  it("fade-held: shows a new text at once with reduced motion, where no row glides", () => {
    motion.isReducedMotion = true;
    const { result, rerender } = renderFading("", "fade-held");

    rerender({ target: LIVELIER, isHeld: true });

    expect(result.current).toEqual({ text: LIVELIER, isWriting: false });
  });
});
