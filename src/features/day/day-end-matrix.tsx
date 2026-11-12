import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayEnd, type DayEndProps } from "./day-end-line";
import { DAY_END_EXAMPLES } from "./day-end-examples";

const FIRST = DAY_END_EXAMPLES[0]!;

/** The days whose line differs: a day's address and a cut change only its menu and question. */
const LINE_EXAMPLES = DAY_END_EXAMPLES.filter(({ address, isCut }) => address !== null && !isCut);

/**
 * The line under a finished day over every edge its numbers reach: a checked written day, a
 * version swapped in, one stop, twelve past the route's waypoints, past midnight, a day with no
 * checks and one whose checks found nothing or were still running. The schema gives every place
 * a point, so a day without coordinates is never drawn; its nearest case is the day of one stop,
 * with no way between places. Its ways along are the day menu's (`DAY_MENU_MATRIX`), and its
 * question, and a cut day's line without it, `DAY_ANSWER_MATRIX`'s.
 */
export const DAY_END_MATRIX: LabMatrix = labMatrix<DayEndProps>({
  key: "day-end",
  title: "The day's end",
  note: "When the day ends, how far it goes and what the map found",
  base: {
    day: FIRST.day,
    shown: FIRST.shown,
    checks: FIRST.checks,
  },
  axes: [
    {
      name: "day",
      values: LINE_EXAMPLES.map(({ label, day, shown, checks }) => ({
        label,
        props: { day, shown, checks },
      })),
    },
  ],
  render: (props) => <DayEnd {...props} />,
});
