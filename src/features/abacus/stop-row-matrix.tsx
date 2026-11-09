import { labMatrix } from "@/lib/lab-matrix";
import { StopRowCell, type StopRowCellProps } from "./stop-row-cell";
import { STOP_ROW_EXAMPLES, STOP_ROW_STATES } from "./stop-row-examples";

/**
 * The golden component, the stop row, across its states, the schema's extremes and its
 * densities. Its density normally follows the energy a row shows; the density axis holds
 * every row at one, so each can be read on any data.
 */
export const STOP_ROW_MATRIX = labMatrix<StopRowCellProps>({
  key: "stop-row",
  title: "Stop row",
  note: "The abacus row in every state, at the schema's extremes, in each density",
  base: { example: 0, state: "complete", density: null },
  axes: [
    {
      name: "state",
      values: STOP_ROW_STATES.map(({ label, key }) => ({ label, props: { state: key } })),
    },
    {
      name: "data",
      values: STOP_ROW_EXAMPLES.map(({ label }, example) => ({ label, props: { example } })),
    },
    {
      name: "density",
      values: [
        { label: "as its energy says", props: { density: null } },
        { label: "open", props: { density: "open" } },
        { label: "standard", props: { density: "standard" } },
        { label: "folded", props: { density: "folded" } },
      ],
    },
  ],
  render: (props) => <StopRowCell {...props} />,
});
