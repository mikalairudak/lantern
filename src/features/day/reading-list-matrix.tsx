import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { READING_DAYS, READING_STATES, type ReadingState } from "./reading-list-examples";
import { ReadingListCell } from "./reading-list-cell";

type ReadingProps = { day: number; state: ReadingState };

/** The reading view's list across the days it meets, from a stream's frames to whole. */
export const READING_LIST_MATRIX: LabMatrix = labMatrix<ReadingProps>({
  key: "reading-list",
  title: "Reading list",
  note: "The day to read, a timetable of the chart's own stops and picks, from its real stream: a stop let in once its row is final, the pen writing it, the versions' second pass, a swap, a re-plan's stops struck and the stops it added",
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
  render: ({ day, state }) => <ReadingListCell day={day} state={state} />,
});
