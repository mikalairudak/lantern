"use client";

import { MotionConfig } from "motion/react";
import { StillNote, useStill } from "@/features/itinerary/use-still";
import { SPRINGS } from "@/lib/tokens/motion";
import { FORK_EXAMPLES, FORK_MOMENTS, forkViewAt } from "@/features/abacus/fork-row-examples";
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
  // Its fork row as a part's proposal stands whole beside the day, ready to take.
  const example = FORK_EXAMPLES.find(({ example: each }) => each.count === 1)?.example;
  const ready = FORK_MOMENTS.find(({ moment }) => moment.status === "proposed")?.moment;
  const fork =
    still.forkAnchor !== undefined && example && ready
      ? {
          view: forkViewAt(example, ready),
          anchors: [still.forkAnchor],
          onChoose: ignore,
          onCompare: ignore,
          onAskAgain: ignore,
        }
      : null;
  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      <ReadingList
        key={`${day}:${state}`}
        stops={still.stops}
        entered={still.entered}
        versionsShown={still.versionsShown}
        picks={still.picks}
        daylight={still.daylight}
        proposed={still.proposed}
        fork={fork}
        heldPen={still.heldPen}
        onChoose={state === "whole" || state === "swapped" ? ignore : undefined}
      />
    </MotionConfig>
  );
}
