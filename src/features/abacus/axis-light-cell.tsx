"use client";

import { MotionConfig } from "motion/react";
import { StillNote, useStill } from "@/features/itinerary/use-still";
import { ENERGY_LEVELS } from "@/lib/schema/itinerary.schema";
import { SPRINGS } from "@/lib/tokens/motion";
import { LIGHT_DAYS, stillOf, type LightDay, type LightState } from "./axis-light-examples";
import { StillRows } from "./stop-row-cell";

export interface AxisLightCellProps {
  /** Into `LIGHT_DAYS`. */
  day: number;
  state: LightState;
}

/** The day a cell is set on; an index past the days is a mistake in the matrix. */
function lightDayAt(day: number): LightDay {
  const chosen = LIGHT_DAYS[day];
  if (!chosen) {
    throw new Error(`The axis light has no day ${day}: it has ${LIGHT_DAYS.length}`);
  }
  return chosen;
}

/**
 * The time axis in the light, as the lab's matrix shows it: a day on the page's frame, its
 * axis in the lamp through golden hour and dotted from sunset to sunrise, its suns and
 * their minutes; whole, as it was being written, or with its last stop open.
 */
export function AxisLightCell({ day, state }: AxisLightCellProps) {
  const chosen = lightDayAt(day);
  const reading = useStill(stillOf(chosen, state));

  if (reading.status !== "read") return <StillNote reading={reading} />;
  return (
    <MotionConfig reducedMotion="user" transition={SPRINGS.layout}>
      <StillRows
        key={`${day}:${state}`}
        still={reading.still}
        requestedEnergy={ENERGY_LEVELS.indexOf(chosen.fixture.request.energy)}
        isOpen={state === "open"}
        isSwapped={false}
        density={null}
      />
    </MotionConfig>
  );
}
