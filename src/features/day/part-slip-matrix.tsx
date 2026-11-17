import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import type { SlipPlacement } from "./part-slip";
import { PartSlipCell, type PartSlipCellProps } from "./part-slip-cell";
import { SLIP_EXAMPLES, SLIP_MOMENTS } from "./part-slip-examples";

const firstExample = SLIP_EXAMPLES[0]?.example;
const firstMoment = SLIP_MOMENTS[0]?.moment;
if (!firstExample || !firstMoment) throw new Error("The part slip's matrix needs its examples");

const PLACEMENTS: readonly { label: string; placement: SlipPlacement }[] = [
  { label: "in the column", placement: "column" },
  { label: "in the margin, where the day's column is whole", placement: "margin" },
];

/**
 * A part's fork on the plan as a slip: the fork line over the part, and the other version of
 * the part as one line a stop beside it. Each moment down, from the press to a choice and every
 * ending; across, a part of two of the day's stops made earlier, a part past midnight, the
 * longest answers, a part of one stop, of three with one that stays, the longest name, a whole
 * day of sixteen, a part that starts the day and one that ends it. Placed in the column, or in
 * the margin beside the plan, which only a laptop's width has: a phone cell sets it in the
 * column.
 */
export const PART_SLIP_MATRIX: LabMatrix = labMatrix<PartSlipCellProps>({
  key: "part-slip",
  title: "Part slip",
  note: "A part's other version on the plan as a slip of times and names, at the head of its part: written, whole, taken, kept and each ending, in the column or the margin",
  base: { example: firstExample, moment: firstMoment, placement: "column" },
  axes: [
    {
      name: "moment",
      values: SLIP_MOMENTS.map(({ label, moment }) => ({ label, props: { moment } })),
    },
    {
      name: "example",
      values: SLIP_EXAMPLES.map(({ label, example }) => ({ label, props: { example } })),
    },
    {
      name: "placement",
      values: PLACEMENTS.map(({ label, placement }) => ({ label, props: { placement } })),
    },
  ],
  // The margin stands beside the abacus's column, so a wide cell takes the page's.
  wide: "page",
  // Moments down alone, Utrecht's morning in the column at a phone's width: every moment of the
  // plan's slip at a phone's width; the other examples and the margin are looked at in the
  // matrix, not shot. A view names axes, not values, so it holds one example.
  baseline: [{ rows: 0, columns: 0 }],
  render: (props, width) => <PartSlipCell {...props} width={width} />,
});
