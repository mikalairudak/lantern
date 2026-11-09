"use client";

import { MotionConfig } from "motion/react";
import { CellNote, StillNote, useStill } from "@/features/itinerary/use-still";
import { ENERGY_LEVELS } from "@/lib/schema/itinerary.schema";
import { SPRINGS } from "@/lib/tokens/motion";
import { SILENCE_DAYS, silenceOf, type SilenceDay, type SilenceMoment } from "./silence-examples";
import { StillRows } from "./stop-row-cell";

export interface SilenceCellProps {
  /** Into `SILENCE_DAYS`. */
  day: number;
  moment: SilenceMoment;
}

/** The day a cell is set on; an index past the days is a mistake in the matrix. */
function silenceDayAt(day: number): SilenceDay {
  const chosen = SILENCE_DAYS[day];
  if (!chosen) {
    throw new Error(`The silences have no day ${day}: they have ${SILENCE_DAYS.length}`);
  }
  return chosen;
}

/**
 * A silence of a day's stream, as the lab's matrix shows it: the day's last rows at that
 * frame, on the page's frame and at its pace, with the waiting line under them.
 */
export function SilenceCell({ day, moment }: SilenceCellProps) {
  const chosen = silenceDayAt(day);
  const reading = useStill(silenceOf(chosen, moment));

  if (reading.status !== "read") return <StillNote reading={reading} />;
  const { still } = reading;
  if ("unreached" in still) return <CellNote>{still.unreached}</CellNote>;
  return (
    // The room a laptop's page keeps under the day, so the waiting line under the last row
    // never meets the cell's edge.
    <div className="pb-6">
      <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
        <StillRows
          key={`${day}:${moment}`}
          still={still}
          requestedEnergy={ENERGY_LEVELS.indexOf(chosen.fixture.request.energy)}
          isOpen={false}
          isSwapped={false}
          density={null}
        />
      </MotionConfig>
    </div>
  );
}
