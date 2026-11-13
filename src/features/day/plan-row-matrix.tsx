import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { PLAN_ROW_EXAMPLES } from "./plan-row-examples";
import { PlanRowCell } from "./plan-row-cell";

/**
 * One row of the day's plan (`docs/decisions.md`, "A day opens on its plan, lit by the day's
 * light"): its bead in each light, ink by day and in golden hour, lit after dark where the rail
 * beside it is dotted, never on a proposal's stop, and lit with its glow growing once a proposal
 * after dark is taken.
 */
export const PLAN_ROW_MATRIX: LabMatrix = labMatrix<{ example: number }>({
  key: "plan-row",
  title: "A row of the plan",
  note: "One stop on the plan in each light: its bead in ink by day, lit after dark beside the dotted rail, never on a proposal's stop, its glow growing once one is taken",
  base: { example: 0 },
  axes: [
    {
      name: "row",
      values: PLAN_ROW_EXAMPLES.map(({ label }, example) => ({ label, props: { example } })),
    },
  ],
  wide: "abacus",
  // Positioned, so the arrows' unseen names stay inside their cell.
  render: ({ example }) => (
    <div className="relative">
      <PlanRowCell example={example} />
    </div>
  ),
});
