"use client";

import { useEffect, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * The content size of an element, kept current with a ResizeObserver. It is null until
 * the first measurement, so the server render and the first client render match. When the
 * element is replaced, the last size holds until the new one is measured, so whatever is
 * drawn to it does not blink.
 */
export function useElementSize(element: HTMLElement | null): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((current) =>
        current?.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return size;
}
