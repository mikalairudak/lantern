import { VIEW_HELD_AFTER_GESTURE_MS } from "./view-hold";

/** Marks each row of the list by its stop's id (`reading-list.tsx`). */
const ROW_SELECTOR = "[data-stop]";

/**
 * Holds the reader's place while the plan's rows change under them: the first row whose bottom
 * is below `top`, the bar held over the plan, keeps its place on the screen while the rows above
 * it take their new heights, so only the rows from it down are seen to move, as "Three pixels a
 * frame" asks (`docs/design-direction.md`). It follows the row each frame for as long as a change
 * of the day's energy glides, and stops at once if the visitor scrolls. Returns a stop.
 */
export function holdFirstRow(
  list: HTMLElement | null,
  top: number,
  forMs: number = VIEW_HELD_AFTER_GESTURE_MS,
): () => void {
  const row = [...(list?.querySelectorAll<HTMLElement>(ROW_SELECTOR) ?? [])].find(
    (each) => each.getBoundingClientRect().bottom > top,
  );
  if (!row) return () => undefined;
  const id = row.getAttribute("data-stop");
  const stood = row.getBoundingClientRect().top;
  const ends = performance.now() + forMs;
  let frame = 0;
  let isStopped = false;
  const stop = () => {
    isStopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
  };
  const follow = () => {
    if (isStopped) return;
    const now = list?.querySelector<HTMLElement>(`[data-stop="${id}"]`);
    if (now) {
      const moved = now.getBoundingClientRect().top - stood;
      if (Math.abs(moved) >= 0.5) window.scrollBy(0, moved);
    }
    if (performance.now() < ends) frame = requestAnimationFrame(follow);
    else stop();
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  frame = requestAnimationFrame(follow);
  return stop;
}
