import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FadeIn, FadeInChanged, sharedEndsOf, type FadedPart } from "./fade-in";

const motion = vi.hoisted(() => ({ isReducedMotion: false }));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motion.isReducedMotion };
});

afterEach(() => {
  motion.isReducedMotion = false;
});

/** A snappy spring settles well within this. */
const SPRING_TIMEOUT = { timeout: 2000 };

/** The element a fade sets its opacity on, if the words are in one. */
function fadeOf(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('span[style*="opacity"]');
}

function fadeIn(of: string) {
  return <FadeIn of={of}>{of}</FadeIn>;
}

describe("FadeIn", () => {
  it("draws the words it first shows as they are, with nothing around them", () => {
    const { container } = render(fadeIn("As first planned: "));

    expect(container.innerHTML).toBe("As first planned: ");
  });

  it("brings words that arrive from none in from part-way faded, to whole", async () => {
    const { container, rerender } = render(fadeIn(""));

    rerender(fadeIn("As first planned: "));

    const fade = fadeOf(container);
    expect(fade).toHaveTextContent("As first planned:");
    expect(fade).toHaveStyle({ opacity: "0.3" });
    await waitFor(() => expect(fade).toHaveStyle({ opacity: "1" }), SPRING_TIMEOUT);
  });

  it("brings each new value in again from part-way faded", async () => {
    const { container, rerender } = render(fadeIn("No more re-plans for now"));
    rerender(fadeIn("Couldn't re-plan just now"));
    await waitFor(() => expect(fadeOf(container)).toHaveStyle({ opacity: "1" }), SPRING_TIMEOUT);

    rerender(fadeIn("The connection dropped"));

    expect(fadeOf(container)).toHaveTextContent("The connection dropped");
    expect(fadeOf(container)).toHaveStyle({ opacity: "0.3" });
  });

  it("sets each change whole at once with reduced motion", () => {
    motion.isReducedMotion = true;
    const { container, rerender } = render(fadeIn(""));

    rerender(fadeIn("As first planned: "));

    expect(fadeOf(container)).toHaveStyle({ opacity: "1" });
  });
});

/** A clause as the sentence sets it: its commas in the sentence's ink, its words apart. */
function clauseParts(words: string): FadedPart[] {
  return [
    { text: words ? ", " : "" },
    { text: words, className: "words" },
    { text: words ? "," : "" },
  ];
}

describe("FadeInChanged", () => {
  it("draws the text it first shows as it is", () => {
    const { container } = render(<FadeInChanged parts={clauseParts("livelier at breakfast")} />);

    expect(container).toHaveTextContent(/^, livelier at breakfast,$/);
    expect(fadeOf(container)).toBeNull();
  });

  it("brings a text that arrives from none in whole, its commas with it", () => {
    const { container, rerender } = render(<FadeInChanged parts={clauseParts("")} />);

    rerender(<FadeInChanged parts={clauseParts("livelier at breakfast")} />);

    const fades = [...container.querySelectorAll('span[style*="opacity"]')];
    expect(fades.map((fade) => fade.textContent).join("")).toBe(", livelier at breakfast,");
    for (const fade of fades) expect(fade).toHaveStyle({ opacity: "0.3" });
  });

  it("brings in only the words that changed, the words it keeps standing as they were", () => {
    const { container, rerender } = render(
      <FadeInChanged parts={clauseParts("livelier at breakfast")} />,
    );

    rerender(<FadeInChanged parts={clauseParts("livelier at breakfast and at lunch")} />);

    expect(container).toHaveTextContent(/^, livelier at breakfast and at lunch,$/);
    const fades = [...container.querySelectorAll('span[style*="opacity"]')];
    expect(fades.map((fade) => fade.textContent)).toEqual([" and at lunch"]);
    // The words kept stand in their own colour, outside any fade.
    const words = container.querySelector(".words");
    expect(words?.firstChild?.textContent).toBe("livelier at breakfast");
  });

  it("brings in a whole word where only its letters changed", () => {
    const { container, rerender } = render(
      <FadeInChanged parts={clauseParts("quieter at lunch")} />,
    );

    rerender(<FadeInChanged parts={clauseParts("quieter and livelier at lunch")} />);

    const fades = [...container.querySelectorAll('span[style*="opacity"]')];
    expect(fades.map((fade) => fade.textContent)).toEqual(["and livelier "]);
  });
});

describe("sharedEndsOf", () => {
  it("shares whole words alone, at either end", () => {
    expect(sharedEndsOf("livelier at lunch", "livelier at lunchtime")).toEqual({
      start: 12,
      end: 0,
    });
    expect(sharedEndsOf("quieter in the morning", "livelier in the morning")).toEqual({
      start: 0,
      end: 15,
    });
    expect(sharedEndsOf("", "livelier")).toEqual({ start: 0, end: 0 });
    expect(sharedEndsOf("livelier", "livelier")).toEqual({ start: 8, end: 0 });
  });
});
