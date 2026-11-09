import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayEnd, type DayEndProps } from "./day-end-line";
import { DAY_END_EXAMPLES } from "./day-end-examples";

const ignore = () => undefined;

const FIRST = DAY_END_EXAMPLES[0]!;

/**
 * The line under a finished day over every edge its numbers and ways reach: a checked quick
 * start, a version swapped in, one stop, twelve past the route's waypoints, past midnight, a
 * day with no checks and one whose checks found nothing or were still running, a cut day and
 * a day with no address. The schema gives every place a point, so a day without coordinates
 * is never drawn; its nearest case is the day of one stop, with no way between places.
 */
export const DAY_END_MATRIX: LabMatrix = labMatrix<DayEndProps>({
  key: "day-end",
  title: "The day's end",
  note: "When the day ends, how far it goes, what the map found and the ways to take it along",
  base: {
    day: FIRST.day,
    shown: FIRST.shown,
    checks: FIRST.checks,
    address: FIRST.address,
    isCut: FIRST.isCut,
    calendarKey: "lab",
    onPlanAnother: ignore,
    onExport: ignore,
  },
  axes: [
    {
      name: "day",
      values: DAY_END_EXAMPLES.map(({ label, day, shown, checks, address, isCut }) => ({
        label,
        props: { day, shown, checks, address, isCut },
      })),
    },
  ],
  render: (props) => <DayEnd {...props} />,
});
