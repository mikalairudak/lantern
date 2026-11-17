import { render } from "@testing-library/react";
import { AnimatePresence } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Fold } from "./fold";

/** A room far taller than a row's reach, so the fold's height opens over seconds. */
const TALL_PX = 600;
/** About a frame's time. */
const FRAME_MS = 20;
/** Past the layout spring's own time, and far short of the stretched height's. */
const SPRING_TIME_MS = 900;

/** An observer that never reports: the fold reads its content's height once, as mounted. */
class SilentObserver {
  observe(): void {}
  disconnect(): void {}
}

function opacityOf(container: HTMLElement): number {
  const fold = container.firstElementChild as HTMLElement;
  return Number.parseFloat(fold.style.opacity || "1");
}

describe("a tall fold's ink", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", SilentObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ width: 300, height: TALL_PX }),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("comes to full on its spring's own time where asked, while its height still opens", async () => {
    const { container } = render(
      <Fold reachPx={28} isInkOnItsSpring>
        <p>Writing the day</p>
      </Fold>,
    );
    await new Promise((done) => setTimeout(done, SPRING_TIME_MS));

    expect(opacityOf(container)).toBe(1);
    const fold = container.firstElementChild as HTMLElement;
    expect(Number.parseFloat(fold.style.height)).toBeLessThan(TALL_PX);
  });

  it("follows its height otherwise, pale while it opens", async () => {
    const { container } = render(
      <Fold reachPx={28}>
        <p>Writing the day</p>
      </Fold>,
    );
    await new Promise((done) => setTimeout(done, SPRING_TIME_MS));

    expect(opacityOf(container)).toBeLessThan(1);
  });

  it("fades from the ink it has when it leaves while still opening, never vanishing in a frame", async () => {
    const tree = (isShown: boolean) => (
      <AnimatePresence>
        {isShown && (
          <Fold key="fold" reachPx={28} isInkOnItsSpring>
            <p>Writing the day</p>
          </Fold>
        )}
      </AnimatePresence>
    );
    const { container, rerender } = render(tree(true));
    await new Promise((done) => setTimeout(done, SPRING_TIME_MS));
    rerender(tree(false));
    await new Promise((done) => setTimeout(done, FRAME_MS));

    expect(opacityOf(container)).toBeGreaterThan(0.5);
  });
});
