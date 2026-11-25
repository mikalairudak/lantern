import { cn } from "@/components/ui/cn";
import type { EnergyLevel } from "@/lib/schema/itinerary.schema";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { PlanBar } from "./plan-energy";

interface PlanBarCellProps {
  energy: EnergyLevel;
  isEnabled: boolean;
  isLocked: boolean;
  /** Set as a 320 px phone sets it, 288 px between its gutters, where the bar breaks in two. */
  isNarrow: boolean;
}

const ignore = () => undefined;

/**
 * The bar held over the plan (`docs/decisions.md`, "A day opens on its plan, lit by the day's
 * light"): the day's five energy words and "Plan · Chart", waiting while the day or a proposal is
 * written, the day's word marked by the energy's bead, and ready once it can be changed, at each
 * end of the scale and in its middle, and on the narrowest phone, where the switch takes a row of
 * its own under the words.
 */
export const PLAN_BAR_MATRIX: LabMatrix = labMatrix<PlanBarCellProps>({
  key: "plan-bar",
  title: "The plan's bar",
  note: "The day's energy as five words beside Plan · Chart, held over the plan: waiting while the day or a proposal is written, the day's word marked by a bead, then ready, the day's word in energy's colour, and in two rows on a 320 px phone",
  base: { energy: "calm", isEnabled: true, isLocked: false, isNarrow: false },
  wide: "abacus",
  axes: [
    {
      name: "day",
      values: [
        { label: "ready", props: { isEnabled: true } },
        { label: "while it is written", props: { isEnabled: false } },
        { label: "while a proposal is written", props: { isEnabled: true, isLocked: true } },
      ],
    },
    {
      name: "energy",
      values: [
        ...(["reflective", "balanced", "social"] as const).map((energy) => ({
          label: energy,
          props: { energy, isNarrow: false },
        })),
        { label: "social, in 320 px", props: { energy: "social", isNarrow: true } },
      ],
    },
  ],
  // A 320 px phone's own gutters inside the cell's, which hold a 390 px phone's.
  render: ({ isNarrow, ...props }) => (
    <div className={cn(isNarrow && "max-w-intro px-4")}>
      <PlanBar {...props} onChoose={ignore} />
    </div>
  ),
});
