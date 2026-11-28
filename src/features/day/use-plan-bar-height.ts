"use client";

import { useLayoutEffect } from "react";

/**
 * The root's custom property that holds the plan's bar's height, which the page's scroll
 * padding clears (`scroll-pt-plan-bar` in globals.css).
 */
export const PLAN_BAR_HEIGHT_PROPERTY = "--plan-bar-height";

/**
 * Keeps the root's `--plan-bar-height` at the bar's height, border and padding included, in
 * whole pixels rounded up, while the bar is on the page, and takes it away once the bar goes.
 * A large text size wraps the bar to three rows or more on a narrow screen, so the page's
 * scroll padding reads the bar's height rather than a row count.
 */
export function usePlanBarHeight(bar: HTMLElement | null): void {
  useLayoutEffect(() => {
    if (!bar) return undefined;
    const root = document.documentElement;
    const measure = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height);
      root.style.setProperty(PLAN_BAR_HEIGHT_PROPERTY, `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar, { box: "border-box" });
    return () => {
      observer.disconnect();
      root.style.removeProperty(PLAN_BAR_HEIGHT_PROPERTY);
    };
  }, [bar]);
}
