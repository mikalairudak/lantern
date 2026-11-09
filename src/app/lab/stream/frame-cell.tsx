"use client";

import { useEffect, useState } from "react";
import type { PartialDay } from "@/lib/stream/outcome";
import { dayText } from "@/lib/stream/simulate-day-stream";
import { FRAME_POINTS, partialAt } from "./frames";
import { PartialDayView } from "./partial-day-view";
import { STREAM_DAYS } from "./stream-days";

export interface FrameCellProps {
  /** Into `STREAM_DAYS`. */
  dayIndex: number;
  /** Into `FRAME_POINTS`. */
  pointIndex: number;
}

type Read = { partial: PartialDay } | { isNeverReached: true } | null;

/** One fixture day at one moment of its stream, for the matrix. */
export function FrameCell({ dayIndex, pointIndex }: FrameCellProps) {
  const [read, setRead] = useState<Read>(null);
  const day = STREAM_DAYS[dayIndex]?.day;
  const point = FRAME_POINTS[pointIndex];

  useEffect(() => {
    if (!day || !point) return undefined;
    const text = dayText(day);
    const at = point.at(text);
    let isCurrent = true;
    if (at === null) {
      queueMicrotask(() => {
        if (isCurrent) setRead({ isNeverReached: true });
      });
    } else {
      void partialAt(text, at).then((partial) => {
        if (isCurrent) setRead({ partial });
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [day, point]);

  if (read === null) return <p className="p-4 text-small text-muted">Reading the day…</p>;
  if ("isNeverReached" in read) {
    return <p className="p-4 text-small text-muted">This day never reaches this moment.</p>;
  }
  return <PartialDayView partial={read.partial} />;
}
