import { labMatrix } from "@/lib/lab-matrix";
import { SilenceCell, type SilenceCellProps } from "./silence-cell";
import { SILENCE_DAYS, SILENCE_MOMENTS } from "./silence-examples";

/**
 * The waiting line in the stream's silences after a stop, on the days whose page frame
 * differs. Each cell is its day's own frame of the stream, so none repeats another.
 */
export const SILENCE_MATRIX = labMatrix<SilenceCellProps>({
  key: "silence",
  title: "Silence",
  note: "The waiting line in the stream's pauses: under the day's last rows before its middle stop and before the versions, and in a bare row's own place while its words wait for its light. A last stop that ends before the hours asked for still waits for a next one, as on the page",
  base: { day: 0, moment: "after-stop" },
  axes: [
    {
      name: "moment",
      values: SILENCE_MOMENTS.map(({ label, key }) => ({ label, props: { moment: key } })),
    },
    {
      name: "day",
      values: SILENCE_DAYS.map(({ label }, day) => ({ label, props: { day } })),
    },
  ],
  render: (props) => <SilenceCell {...props} />,
});
