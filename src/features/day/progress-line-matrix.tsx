import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { ProgressLine } from "./foot-line";
import { progressWordsOf, type DayProgress } from "./progress";

interface ProgressLineCellProps {
  progress: DayProgress;
}

/** The line under a day's chart at one moment of the day's writing. */
function ProgressLineCell({ progress }: ProgressLineCellProps) {
  const words = progressWordsOf(progress);
  return words === null ? null : <ProgressLine>{words}</ProgressLine>;
}

/**
 * The line under the chart in every moment it says something (`docs/decisions.md`, "Designing for
 * Dynamic UI"): as the stops arrive, and as the versions arrive stop by stop. Before the first row
 * the header says the day is being written, and once it is written the day's end stands in the
 * line's place (`DayEnd`, its own matrix).
 */
export const PROGRESS_LINE_MATRIX: LabMatrix = labMatrix<ProgressLineCellProps>({
  key: "progress-line",
  title: "The line under the chart",
  note: "How far the day is written, from its first row to its versions",
  base: { progress: { kind: "stops", count: 1 } },
  axes: [
    {
      name: "moment",
      values: [
        { label: "its first stop", props: { progress: { kind: "stops", count: 1 } } },
        { label: "its stops so far", props: { progress: { kind: "stops", count: 6 } } },
        {
          label: "its versions, stop by stop",
          props: { progress: { kind: "versions", reached: 4, of: 9 } },
        },
      ],
    },
  ],
  render: (props) => <ProgressLineCell {...props} />,
});
