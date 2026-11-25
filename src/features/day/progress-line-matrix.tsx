import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import type { DayProgress } from "./progress";
import { ProgressLineCell, type ProgressLineCellProps } from "./progress-line-cell";

/** The most stops a day holds, as the crowded edge day does: the longest count. */
const MOST_STOPS = 12;

const FIRST_STOP: DayProgress = { kind: "stops", count: 1 };
const STOPS_SO_FAR: DayProgress = { kind: "stops", count: 6 };
const VERSIONS: DayProgress = { kind: "versions", reached: 4, of: 9 };
const LONGEST: DayProgress = { kind: "versions", reached: MOST_STOPS, of: MOST_STOPS };

/**
 * The line under the chart in every moment it says something (`docs/decisions.md`, "Designing
 * for Dynamic UI"): as the stops arrive, and as the versions arrive stop by stop, from the
 * shortest words to the longest. Before the first row the header says the day is being written,
 * and once it is written the day's end stands in the line's place (`DayEnd`, its own matrix).
 * While a written day the page holds whole plays, the line offers it whole on a press, alone
 * before the first row (`docs/decisions.md`, "A written day's play offers the day whole on a
 * press"); a live, typed, kept or seen day has the words alone.
 */
export const PROGRESS_LINE_MATRIX: LabMatrix = labMatrix<ProgressLineCellProps>({
  key: "progress-line",
  title: "The line under the chart",
  note: "How far the day is written, from its first row to its versions, and a written day's press",
  base: { progress: FIRST_STOP, isPressOffered: false },
  axes: [
    {
      name: "moment",
      values: [
        { label: "its first stop", props: { progress: FIRST_STOP } },
        { label: "its stops so far", props: { progress: STOPS_SO_FAR } },
        { label: "its versions, stop by stop", props: { progress: VERSIONS } },
        { label: "its longest count", props: { progress: LONGEST } },
        {
          label: "a written day's play, before its first stop",
          props: { progress: { kind: "stops", count: 0 }, isPressOffered: true },
        },
        {
          label: "a written day's play, its first stop",
          props: { progress: FIRST_STOP, isPressOffered: true },
        },
        {
          label: "a written day's play, its versions",
          props: { progress: VERSIONS, isPressOffered: true },
        },
        {
          label: "a written day's play, its longest count",
          props: { progress: LONGEST, isPressOffered: true },
        },
      ],
    },
  ],
  render: (props) => <ProgressLineCell {...props} />,
});
