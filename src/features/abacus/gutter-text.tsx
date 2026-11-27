"use client";

import { useLayoutEffect, useRef } from "react";
import type { GutterText } from "./drawing";

/** The widest time: the times' figures are tabular, so every time is as wide as this one. */
const WIDEST_TIME = "00:00";

/** A sun's minute beside it on the axis, as `AxisSun` sets it. */
const MINUTE_CLASSES = "absolute text-caption whitespace-nowrap tabular-nums";
/** A stop's time in the gutter, as `StartTime` sets it. */
const TIME_CLASSES = "absolute type-time whitespace-nowrap";

/**
 * Unseen copies of a time and of a sun's minute, set as the gutter sets them, which report
 * their size at the browser's text size before the first paint, and again when it changes, as
 * when the fonts arrive. The chart's drawing follows the root's growth alone; its time column
 * follows them (`drawingForText`).
 */
export function GutterTextProbe({ onMeasure }: { onMeasure: (text: GutterText) => void }) {
  const time = useRef<HTMLSpanElement>(null);
  const minute = useRef<HTMLSpanElement>(null);
  const onMeasureRef = useRef(onMeasure);
  useLayoutEffect(() => {
    onMeasureRef.current = onMeasure;
  });
  useLayoutEffect(() => {
    const timeCopy = time.current;
    const minuteCopy = minute.current;
    if (!timeCopy || !minuteCopy) return undefined;
    // To the fraction of a pixel, so a time's column is never a fraction narrower than it.
    const measure = () => {
      const timeBox = timeCopy.getBoundingClientRect();
      onMeasureRef.current({
        timeWidth: timeBox.width,
        timeHeight: timeBox.height,
        minuteHeight: minuteCopy.getBoundingClientRect().height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(timeCopy);
    observer.observe(minuteCopy);
    return () => observer.disconnect();
  }, []);
  return (
    <span aria-hidden className="invisible absolute top-0 left-0 size-0 overflow-hidden">
      <span ref={time} className={TIME_CLASSES}>
        {WIDEST_TIME}
      </span>
      <span ref={minute} className={MINUTE_CLASSES}>
        {WIDEST_TIME}
      </span>
    </span>
  );
}
