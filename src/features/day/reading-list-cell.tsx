"use client";

import { MotionConfig } from "motion/react";
import { StillNote, useStill } from "@/features/itinerary/use-still";
import { SPRINGS } from "@/lib/tokens/motion";
import { readingStillOf, type ReadingState } from "./reading-list-examples";
import { ReadingList } from "./reading-list";

export interface ReadingListCellProps {
  /** Into `READING_DAYS`. */
  day: number;
  state: ReadingState;
}

const ignore = () => undefined;

/** The list to read at a moment of its day, as the lab's matrix shows it. */
export function ReadingListCell({ day, state }: ReadingListCellProps) {
  const reading = useStill(readingStillOf(day, state));
  if (reading.status !== "read") return <StillNote reading={reading} />;
  const { still } = reading;
  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      <ReadingList
        key={`${day}:${state}`}
        stops={still.stops}
        entered={still.entered}
        versionsShown={still.versionsShown}
        picks={still.picks}
        daylight={still.daylight}
        heldPen={still.heldPen}
        onChoose={state === "whole" || state === "swapped" ? ignore : undefined}
      />
    </MotionConfig>
  );
}
