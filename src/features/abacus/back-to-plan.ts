import {
  isTakenBackBy,
  marginBoxOf,
  revealInView,
  TAKEN_BACK_BY,
} from "@/components/ui/reveal-in-view";

/**
 * The longest the slider "Back to the plan" gave the focus to waits for the rows to rest: they
 * glide for about half a second, and a wait with no end would scroll long after the visitor
 * has moved on.
 */
export const BACK_FOCUS_WAIT_MS = 1200;

/** A wait for the rows "Back to the plan" set gliding to rest. */
export interface BackFocusWait {
  /** The slider the press gave the focus to. */
  slider: Element;
  /** The rows rest: the wait ends, and the page weighs once whether to bring the slider in. */
  rest: () => void;
  /** Ends the wait, and the reveal it set off, scrolling nothing more. */
  cancel: () => void;
}

/** Whether an element shows the focus's ring, as it does for a focus from the keys. */
function isRingShown(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * Whether `element`, its scroll margins round it, lies wholly in the window: under the room
 * `coveredTop` that something held at the screen's top covers, and over the window's foot.
 */
function isWhollyInView(element: Element, coveredTop: number): boolean {
  const { top, bottom } = marginBoxOf(element, coveredTop);
  return top >= 0 && bottom <= innerHeight;
}

/**
 * Waits until the rows "Back to the plan" set gliding rest, or `BACK_FOCUS_WAIT_MS`, whichever
 * comes first, then weighs `slider` once: while it shows the focus's ring, as after a key, and
 * is not wholly in the window, under what is held at the screen's top (`coveredTopOf`) and over
 * its foot, the page brings it in the least way (`revealInView`), at once under reduced motion.
 * A focus with no ring, as after a pointer's press alone, scrolls nothing. A wheel, a touch, a
 * press or a key pressed before then ends the wait, as each ends the reveal: the visitor has
 * taken the page. A key held down repeating ends neither, as Enter held on the button goes on
 * after the press (`isTakenBackBy`). Once weighed, the wait hears nothing more.
 */
export function waitToBringIn(
  slider: Element,
  { isReducedMotion, coveredTopOf }: { isReducedMotion: boolean; coveredTopOf: () => number },
): BackFocusWait {
  let isWaiting = true;
  let stopReveal = () => {};
  let cap = 0;
  const end = () => {
    isWaiting = false;
    window.clearTimeout(cap);
    for (const kind of TAKEN_BACK_BY) removeEventListener(kind, takenBack, { capture: true });
  };
  const cancel = () => {
    end();
    stopReveal();
  };
  const takenBack = (event: Event) => {
    if (isTakenBackBy(event)) cancel();
  };
  const rest = () => {
    if (!isWaiting) return;
    end();
    if (!slider.isConnected || !isRingShown(slider)) return;
    const coveredTop = coveredTopOf();
    if (!isWhollyInView(slider, coveredTop)) {
      stopReveal = revealInView(slider, isReducedMotion, { coveredTop });
    }
  };
  cap = window.setTimeout(rest, BACK_FOCUS_WAIT_MS);
  for (const kind of TAKEN_BACK_BY) {
    addEventListener(kind, takenBack, { capture: true, passive: true });
  }
  return { slider, rest, cancel };
}
