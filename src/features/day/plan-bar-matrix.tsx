import type { EnergyLevel } from "@/lib/schema/itinerary.schema";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { PlanBar } from "./plan-energy";

interface PlanBarCellProps {
  energy: EnergyLevel;
  isEnabled: boolean;
}

const ignore = () => undefined;

/**
 * The bar held over the plan (`docs/decisions.md`, "A day opens on its plan, lit by the day's
 * light"): the day's five energy words and "Plan · Chart", waiting while the day is written and
 * ready once it can be changed, at each end of the scale and in its middle.
 */
export const PLAN_BAR_MATRIX: LabMatrix = labMatrix<PlanBarCellProps>({
  key: "plan-bar",
  title: "The plan's bar",
  note: "The day's energy as five words beside Plan · Chart, held over the plan: waiting, then ready, the day's word in energy's colour",
  base: { energy: "calm", isEnabled: true },
  wide: "abacus",
  axes: [
    {
      name: "day",
      values: [
        { label: "ready", props: { isEnabled: true } },
        { label: "while it is written", props: { isEnabled: false } },
      ],
    },
    {
      name: "energy",
      values: (["reflective", "balanced", "social"] as const).map((energy) => ({
        label: energy,
        props: { energy },
      })),
    },
  ],
  render: (props) => <PlanBar {...props} onChoose={ignore} />,
});
