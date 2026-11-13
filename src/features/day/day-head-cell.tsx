"use client";

import { DayStageHeaderCell, type DayStageHeaderCellProps } from "./day-stage-header-cell";
import { HEADER_DAYS, type HeaderMoment } from "./day-stage-header-examples";
import { PlanBar } from "./plan-energy";

export type DayHeadCellProps = DayStageHeaderCellProps;

/** The moments the page draws the plan's bar under the head in: a day written whole. */
const BAR_MOMENTS: ReadonlySet<HeaderMoment> = new Set(["written", "replan-writing-list"]);

const ignore = () => undefined;

/**
 * The day's head at one moment, over the plan's bar where the page has one, in the plan's
 * column as `day-stage.tsx` sets it, so the head's edge is read against the plan's.
 */
export function DayHeadCell({ day, moment }: DayHeadCellProps) {
  const energy = HEADER_DAYS[day]?.request.energy ?? "balanced";
  return (
    <>
      <DayStageHeaderCell day={day} moment={moment} />
      {BAR_MOMENTS.has(moment) && (
        <div className="lg:max-w-abacus">
          <PlanBar energy={energy} isEnabled onChoose={ignore} />
        </div>
      )}
    </>
  );
}
