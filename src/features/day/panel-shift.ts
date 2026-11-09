/** Keeps a word's open list this far inside its bounds' edges: the page's own gutter. */
export const VIEWPORT_GUTTER = 16;

/** A box's left and right edges, in the viewport's pixels. */
export interface Edges {
  left: number;
  right: number;
}

/**
 * How far to move a word's open list sideways, in pixels, so it stays inside its bounds:
 * right when it would start past the left gutter, as by a word that begins a phone's line,
 * left when it would end past the right one. A list wider than the room between the two
 * gutters keeps its start in view, where its rows begin.
 */
export function panelShiftOf(box: Edges, bounds: Edges, gutter: number = VIEWPORT_GUTTER): number {
  const start = bounds.left + gutter;
  const intoLeft = start - box.left;
  if (intoLeft > 0) return intoLeft;
  const intoRight = box.right - (bounds.right - gutter);
  if (intoRight <= 0) return 0;
  return -Math.min(intoRight, box.left - start);
}

/**
 * What a word's open list stays inside: its nearest container, as `cqi` reads one, or the
 * screen when there is none. The product has no containers, so a list keeps to the screen;
 * a phone cell in `/lab/matrix` is one, so a list there keeps to the cell, as on a phone,
 * wherever the cell sits on the page.
 */
export function panelBoundsOf(panel: Element): Edges {
  for (let box = panel.parentElement; box; box = box.parentElement) {
    const { containerType } = getComputedStyle(box);
    if (containerType && containerType !== "normal") return box.getBoundingClientRect();
  }
  return { left: 0, right: document.documentElement.clientWidth };
}

/**
 * The shift that keeps an open list inside its bounds, measured from where the list sits
 * unshifted. A box measured on screen carries whatever shift is drawn already (`placeShift`),
 * so it is taken off first: measured again, as React's development mode does on mount, the
 * list keeps its shift rather than losing it.
 */
export function shiftToFit(panel: HTMLElement): number {
  const { left, right } = panel.getBoundingClientRect();
  const drawn = Number(panel.dataset[SHIFT_DATA]) || 0;
  return panelShiftOf({ left: left - drawn, right: right - drawn }, panelBoundsOf(panel));
}

/** Where a list keeps the shift it is drawn with, for `shiftToFit` to take off. */
const SHIFT_DATA = "shift";

/**
 * Moves a hanging list sideways by its margins, in its own layout: by its left margin when it
 * hangs from its word's left, and by its right one when it hangs from its right, as the icon's
 * list does. Whichever side it is placed from moves it; the other changes nothing. The shift
 * adds to the margins its classes give it, the pixel a list hung from its word's left keeps
 * among them, and with none it leaves them as they are.
 */
export function placeShift(panel: HTMLElement, shift: number): void {
  panel.style.marginLeft = "";
  panel.style.marginRight = "";
  panel.dataset[SHIFT_DATA] = String(shift);
  if (shift === 0) return;
  const base = getComputedStyle(panel);
  panel.style.marginLeft = `${(Number.parseFloat(base.marginLeft) || 0) + shift}px`;
  panel.style.marginRight = `${(Number.parseFloat(base.marginRight) || 0) - shift}px`;
}
