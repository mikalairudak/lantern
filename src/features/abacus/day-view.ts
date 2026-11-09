import type { ChartScale } from "./geometry";

/** The edges of what can be seen of the day, in the viewport's pixels. */
interface Viewport {
  top: number;
  bottom: number;
}

/**
 * The nearest ancestor that scrolls the day, else the window. The product's day scrolls with
 * its page; a lab concept still scrolls its chart in a column of its own on a laptop.
 */
function viewportOf(element: HTMLElement): Viewport {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }
  }
  return { top: 0, bottom: window.innerHeight };
}

/** What an ancestor's computed `overflow-y` is when it cuts off what lies past its edges. */
const CLIPPING_OVERFLOWS = new Set(["hidden", "clip", "auto", "scroll"]);

/** The nearest ancestor that cuts off what lies past its edges, as a lab cell does; or none. */
function clippingAncestorOf(element: HTMLElement): HTMLElement | null {
  for (
    let node = element.parentElement;
    node && node !== document.body;
    node = node.parentElement
  ) {
    if (CLIPPING_OVERFLOWS.has(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/**
 * How far above `element` its page can still show what is laid over it: up to the top of
 * what the nearest ancestor that clips it can scroll to, as a cell in the lab's matrix does,
 * or else of the document.
 */
export function roomAboveOf(element: HTMLElement): number {
  const top = element.getBoundingClientRect().top;
  const clip = clippingAncestorOf(element);
  if (clip) return top - (clip.getBoundingClientRect().top + clip.clientTop - clip.scrollTop);
  return top + window.scrollY;
}

/** The empty room between the bottom of what stands above `element` and its top. */
export function roomUnder(above: HTMLElement, element: HTMLElement): number {
  return element.getBoundingClientRect().top - above.getBoundingClientRect().bottom;
}

/**
 * How far the page runs on under `element` to its end, as the page's foot and the padding
 * under it do. None inside an ancestor that clips it, as a lab cell, which ends where
 * the day does.
 */
export function tailUnderOf(element: HTMLElement): number {
  if (clippingAncestorOf(element)) return 0;
  const bottom = element.getBoundingClientRect().bottom + window.scrollY;
  return Math.max(0, document.documentElement.scrollHeight - bottom);
}

/** The part of the day's plot in view, in the frame's pixels. */
export interface DayView {
  top: number;
  bottom: number;
}

/**
 * Measures what of the frame's plot is in view, `room` inside each of the view's edges, so
 * the ring that invites the first drag waits among the stops a visitor can see.
 */
export function dayViewOf(frame: HTMLElement, scale: ChartScale, room: number): DayView {
  const viewport = viewportOf(frame);
  const frameTop = frame.getBoundingClientRect().top;
  const hiddenAbove = Math.max(0, viewport.top - frameTop);
  return {
    top: Math.max(scale.plotTop, hiddenAbove + room),
    bottom: Math.min(scale.plotBottom, viewport.bottom - frameTop - room),
  };
}
