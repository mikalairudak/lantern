import { labMatrix } from "@/lib/lab-matrix";
import { AxisLightCell, type AxisLightCellProps } from "./axis-light-cell";
import { LIGHT_DAYS, LIGHT_STATES } from "./axis-light-examples";

/** The days, the matrix's second axis. */
const DAY_AXIS = 1;

/**
 * The light on the time axis, over days from an evening into night to a sun that never
 * sets: whole, as each was being written, and with its last stop open.
 */
export const AXIS_LIGHT_MATRIX = labMatrix<AxisLightCellProps>({
  key: "axis-light",
  title: "Light on the time axis",
  note: "The axis runs in the lamp through golden hour and dotted from sunset to sunrise, the sun's minute beside it where it keeps clear of the times",
  base: { day: 0, state: "whole" },
  axes: [
    {
      name: "state",
      values: LIGHT_STATES.map(({ label, key }) => ({ label, props: { state: key } })),
    },
    {
      name: "day",
      values: LIGHT_DAYS.map(({ label }, day) => ({ label, props: { day } })),
    },
  ],
  render: (props) => <AxisLightCell {...props} />,
  // Each day whole, as a visitor finds it. In a cell an open sheet has neither the header
  // above it nor the page's tail below, so it lies where no page puts it.
  baseline: [{ rows: DAY_AXIS, columns: DAY_AXIS }],
});
