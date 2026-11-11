"use client";

import { cn } from "@/components/ui/cn";
import { ENERGY_LEVELS, type EnergyLevel } from "@/lib/schema/itinerary.schema";
import { TARGET_CLASSES } from "./link-classes";
import { energyLabelOf } from "./sentence";

/**
 * The day's energy on its plan: the five words of the headline's energy word, the day's in
 * energy's colour, held at the top with the view's switch while the plan scrolls, so on a phone
 * the day's energy stays one tap away. A word chosen is the headline's word chosen: the day moves
 * to the versions nearest it, and the headline says so (`docs/decisions.md`, "A day opens on its
 * plan, lit by the day's light"). Until the day can be changed, the words are said and wait.
 */
export function PlanEnergy({
  energy,
  isEnabled,
  onChoose,
  className,
}: {
  /** The day's energy as the headline says it now. */
  energy: EnergyLevel;
  isEnabled: boolean;
  onChoose: (energy: EnergyLevel) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="The day's energy"
      className={cn("flex flex-wrap items-baseline gap-x-3 type-note", className)}
    >
      {ENERGY_LEVELS.map((level) => {
        const isOn = level === energy;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={isOn}
            aria-disabled={!isEnabled || undefined}
            onClick={() => isEnabled && !isOn && onChoose(level)}
            className={cn(
              TARGET_CLASSES,
              "rounded-sm focus-ring transition-colors",
              isOn
                ? "text-energy underline decoration-curve decoration-2 underline-offset-4"
                : "text-muted not-aria-disabled:hover:text-ink aria-disabled:cursor-default",
            )}
          >
            {energyLabelOf(level)}
          </button>
        );
      })}
    </div>
  );
}
