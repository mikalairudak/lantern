"use client";

import { useSyncExternalStore } from "react";
import { BROWSER_TEXT_ATTRIBUTE, DEFAULT_ROOT_PX } from "@/lib/tokens/root";

/**
 * The root's size follows the viewport's width on a large screen, so it is read again
 * whenever the window is resized; the browser's own text size has no event, and is read as
 * the page draws.
 */
export function subscribeToResize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** The root's font size in pixels as the browser computes it; the default where it cannot. */
export function rootFontPx(): number {
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_ROOT_PX;
}

/**
 * The root's font size in pixels, read as the page draws, before the browser paints, and
 * again when the window is resized. Null on the server, which has no root to read.
 */
export function useRootFontPx(): number | null {
  return useSyncExternalStore(subscribeToResize, rootFontPx, () => null);
}

/**
 * The browser's own text size in pixels, which the visitor sets and the root grows from on a
 * large screen: read off the root layout's unseen element set to `medium`
 * (`BrowserTextSize`), the default where there is none.
 */
export function browserFontPx(): number {
  const probe = document.querySelector(`[${BROWSER_TEXT_ATTRIBUTE}]`);
  const size = probe ? Number.parseFloat(getComputedStyle(probe).fontSize) : Number.NaN;
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_ROOT_PX;
}

/**
 * How much the root has grown on a large screen: its size over the browser's own. Exactly 1
 * up to the viewport the growth starts at, whatever text size the visitor has set, and a
 * quarter more at its end.
 */
export function rootGrowth(): number {
  return rootFontPx() / browserFontPx();
}

/**
 * The root's growth, read as the page draws, before the browser paints, with the root's own
 * size, and again when the window is resized. 1 on the server, which has no root to read.
 */
export function useRootGrowth(): number {
  return useSyncExternalStore(subscribeToResize, rootGrowth, () => 1);
}
