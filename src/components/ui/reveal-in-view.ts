import { physicsOf, REVEAL_STEP_PX, SPRINGS } from "@/lib/tokens/motion";

/** Which edge of an element the page scrolls to: its top, or its foot to the screen's. */
type Edge = "top" | "foot";

/**
 * The reveal on its way, by its stop, and whether it is scrolling the page yet: one watching an
 * element in view scrolls nothing until growth pushes it out.
 */
let revealing: { stop: () => void; isScrolling: boolean } | null = null;

/**
 * Whether a reveal is scrolling the page (`revealInView`). What holds the view still as
 * something above it grows stands down meanwhile: the reveal's way is read from where the
 * element stands each frame, so that growth is already in it, and a second scroll in the same
 * frame would pull against it. A reveal that only watches leaves the hold to it.
 */
export function isRevealing(): boolean {
  return revealing?.isScrolling ?? false;
}

/** What the visitor does that takes the page back from a reveal on its way. */
const TAKEN_BACK_BY = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** How close to its end the spring is once it has come there, as a share of its way. */
const SPRING_DONE = 0.001;
/** How close to where it goes the page is once it is there, in px. */
const ARRIVED_PX = 0.5;
const MS_PER_SECOND = 1000;

/** `element`'s box on the screen, with its scroll margins around it. */
function marginBoxOf(element: HTMLElement): { top: number; bottom: number } {
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    top: box.top - (Number.parseFloat(style.scrollMarginTop) || 0),
    bottom: box.bottom + (Number.parseFloat(style.scrollMarginBottom) || 0),
  };
}

/**
 * The edge to bring `element` to, the least way, as `scrollIntoView`'s "nearest" does: none
 * when it is in view, its top when it is above the screen or taller than it, and its foot to
 * the screen's foot when it is below.
 */
function edgeOf(element: HTMLElement): Edge | null {
  const { top, bottom } = marginBoxOf(element);
  if (top >= 0 && bottom <= innerHeight) return null;
  return top < 0 || bottom - top > innerHeight ? "top" : "foot";
}

/**
 * The edge a reveal on its way keeps to: the one it set off for, but the top once the element
 * has grown taller than the screen, whose foot would carry its top out of view.
 */
function keptEdgeOf(element: HTMLElement, edge: Edge): Edge {
  const { top, bottom } = marginBoxOf(element);
  return edge === "foot" && bottom - top > innerHeight ? "top" : edge;
}

/** Where the page's scroll brings `edge` of `element` into place, read where it stands now. */
function scrollTopFor(element: HTMLElement, edge: Edge): number {
  const { top, bottom } = marginBoxOf(element);
  const to = scrollY + (edge === "top" ? top : bottom - innerHeight);
  const most = document.documentElement.scrollHeight - innerHeight;
  return Math.min(Math.max(to, 0), Math.max(most, 0));
}

/**
 * How far the gentle spring has come `seconds` into its way, as a share of it. It does not
 * bounce, so it is critically damped and its path has this closed form.
 */
function gentleShareAt(seconds: number): number {
  const angular = Math.sqrt(physicsOf(SPRINGS.gentle).stiffness);
  const turned = angular * seconds;
  return 1 - (1 + turned) * Math.exp(-turned);
}

/**
 * How long a reveal watches an element in view, in ms: as long as the gentle spring takes to
 * come to its end, the time what it opened with grows in, as a header's line and lead do.
 */
const WATCH_MS = (() => {
  let ms = 0;
  while (gentleShareAt(ms / MS_PER_SECOND) < 1 - SPRING_DONE) ms += 1;
  return ms;
})();

/**
 * Scrolls the page until `element` is in view with its scroll margins around it, the least
 * way, on the gentle spring, and at once with reduced motion. Its way is read again every
 * frame from where the element stands, so a header growing above it as it comes, which moves
 * it down, moves where the scroll goes rather than pushing it back out of view. No frame
 * scrolls further than `REVEAL_STEP_PX`, so a frame drawn late catches up over the next ones.
 * An element in view is watched for the spring's time (`WATCH_MS`), scrolling nothing, and
 * revealed from where the page stands once growth above pushes it out. One reveal at a time:
 * a new one stops the one on its way, and so does the visitor's wheel, touch, press or key.
 * Gives back a stop.
 */
export function revealInView(element: HTMLElement, isReducedMotion: boolean): () => void {
  revealing?.stop();
  let frame = 0;
  // Set once the element is out of view: where the page stood then, and the edge it goes for.
  let way: { from: number; edge: Edge; started: number | null } | null = null;
  let shown = scrollY;
  let watchedSince: number | null = null;
  // The browser's own scroll anchoring stands down while it scrolls, as the view's hold does:
  // left on, it scrolled the page for a line of the headline's that changed above, 38 px in
  // one frame, and the reveal scrolled it back the next.
  const root = document.documentElement;
  const anchoring = root.style.overflowAnchor;
  const current = { stop: () => {}, isScrolling: false };
  const stop = () => {
    if (revealing !== current) return;
    revealing = null;
    cancelAnimationFrame(frame);
    if (current.isScrolling) root.style.overflowAnchor = anchoring;
    for (const kind of TAKEN_BACK_BY) removeEventListener(kind, stop, { capture: true });
  };
  current.stop = stop;
  /** Sets off for `edge` from where the page stands; at once with reduced motion. */
  const setOff = (edge: Edge): boolean => {
    if (isReducedMotion) {
      window.scrollTo({ top: scrollTopFor(element, edge), behavior: "instant" });
      return false;
    }
    shown = scrollY;
    way = { from: shown, edge, started: null };
    current.isScrolling = true;
    root.style.overflowAnchor = "none";
    return true;
  };
  const step = (now: number) => {
    if (way === null) {
      watchedSince ??= now;
      const edge = edgeOf(element);
      if (edge !== null && !setOff(edge)) return stop();
      if (edge === null && now - watchedSince >= WATCH_MS) return stop();
      if (way === null) {
        frame = requestAnimationFrame(step);
        return undefined;
      }
    }
    way.started ??= now;
    way.edge = keptEdgeOf(element, way.edge);
    const share = gentleShareAt((now - way.started) / MS_PER_SECOND);
    const to = scrollTopFor(element, way.edge);
    const wanted = way.from + (to - way.from) * Math.min(share, 1);
    shown += Math.max(-REVEAL_STEP_PX, Math.min(REVEAL_STEP_PX, wanted - shown));
    window.scrollTo({ top: shown, behavior: "instant" });
    if (share >= 1 - SPRING_DONE && Math.abs(to - shown) < ARRIVED_PX) stop();
    else frame = requestAnimationFrame(step);
    return undefined;
  };
  revealing = current;
  for (const kind of TAKEN_BACK_BY) {
    addEventListener(kind, stop, { capture: true, passive: true });
  }
  // Out of view already, it sets off at once; with reduced motion it is there in this call.
  const edge = edgeOf(element);
  if (edge !== null && !setOff(edge)) {
    stop();
    return () => {};
  }
  frame = requestAnimationFrame(step);
  return stop;
}
