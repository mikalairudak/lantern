import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { READING_DAYS, READING_STATES, type ReadingState } from "./reading-list-examples";
import { ReadingListCell } from "./reading-list-cell";

type PlanProps = { day: number; state: ReadingState };

/**
 * The day's plan (`docs/decisions.md`, "A day opens on its plan, lit by the day's light"): a
 * timetable of the chart's own stops and picks, from its real stream, with the rail of the day's
 * light beside the times and the sun's minutes where they fall. Every state the list meets, from
 * a stop let in once its row is final, the pen writing it and the versions' second pass, to a
 * swap and a re-plan's fork, on every day it has, so twelve stops, one stop, a night past
 * midnight and a proposal are drawn too.
 */
export const PLAN_MATRIX: LabMatrix = labMatrix<PlanProps>({
  key: "plan",
  title: "The day's plan",
  note: "The day's plan, from its real stream to a swap and a fork: the rail of the day's light down the times, golden hour in the lamp, dusk and night dotted, the sun's minutes where they fall",
  base: { day: 0, state: "whole" },
  axes: [
    {
      name: "state",
      values: READING_STATES.map(({ key, label }) => ({ label, props: { state: key } })),
    },
    {
      name: "day",
      values: READING_DAYS.map(({ label }, day) => ({ label, props: { day } })),
    },
  ],
  wide: "abacus",
  // States down, days across: the default view, shot on purpose.
  baseline: [{ rows: 0, columns: 1 }],
  render: ({ day, state }) => <ReadingListCell day={day} state={state} />,
});
