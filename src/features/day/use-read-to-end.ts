"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * How long the line under a whole day stays in view before the day counts as read to its end:
 * about as long as its first line takes to read, so a page scrolled past it does not count.
 */
export const READ_TO_END_MS = 1000;

/** How much of the line is on screen for it to be in view: most of it. */
export const READ_TO_END_SHARE = 0.5;

/**
 * Calls `onRead` once the element has stayed in view for `READ_TO_END_MS`, and never again
 * for the same `read`, the thing the element ends; another is watched afresh. The wait starts
 * again from nothing whenever the element leaves the screen or the page is hidden, and ends
 * unspent when the element goes, as when the visitor plays another day or leaves the page, so
 * a day left first is never counted. Without `onRead`, or in a browser that cannot tell what
 * is on screen, nothing is watched.
 */
export function useReadToEnd(
  ref: RefObject<Element | null>,
  read: unknown,
  onRead: (() => void) | undefined,
): void {
  const latest = useRef(onRead);
  useLayoutEffect(() => {
    latest.current = onRead;
  });
  const isWatched = onRead !== undefined;

  useEffect(() => {
    const element = ref.current;
    if (!isWatched || element === null || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    let isInView = false;
    let wait: number | undefined;
    const stopWaiting = () => {
      window.clearTimeout(wait);
      wait = undefined;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry === undefined) return;
        isInView = entry.isIntersecting && entry.intersectionRatio >= READ_TO_END_SHARE;
        waitWhileInView();
      },
      { threshold: READ_TO_END_SHARE },
    );
    const tell = () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", waitWhileInView);
      latest.current?.();
    };
    function waitWhileInView() {
      const isShown = isInView && document.visibilityState !== "hidden";
      if (!isShown) stopWaiting();
      else if (wait === undefined) wait = window.setTimeout(tell, READ_TO_END_MS);
    }
    observer.observe(element);
    document.addEventListener("visibilitychange", waitWhileInView);
    return () => {
      stopWaiting();
      observer.disconnect();
      document.removeEventListener("visibilitychange", waitWhileInView);
    };
  }, [ref, read, isWatched]);
}
