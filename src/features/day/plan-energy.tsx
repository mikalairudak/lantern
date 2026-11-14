"use client";

import type { Ref } from "react";
import { cn } from "@/components/ui/cn";
import { ENERGY_LEVELS, type EnergyLevel } from "@/lib/schema/itinerary.schema";
import { TARGET_CLASSES } from "./link-classes";
import { energyLabelOf } from "./sentence";
import { DayViewSwitch } from "./view-switch";

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
      role="group"
      aria-label="How lively the day is"
      className={cn("flex flex-wrap items-baseline gap-x-3 type-note", className)}
    >
      {ENERGY_LEVELS.map((level) => {
        const isOn = level === energy;
        return (
          <button
            key={level}
            type="button"
            aria-pressed={isOn}
            aria-disabled={!isEnabled || undefined}
            onClick={() => isEnabled && !isOn && onChoose(level)}
            className={cn(
              TARGET_CLASSES,
              // Six past the words sideways, where a link reaches eight: neighbours 12 px apart
              // meet between them and never cross, so each word keeps its own target.
              "rounded-sm focus-ring transition-colors after:-inset-x-1.5",
              // As the view's switch has it: the one on show in its colour, the others underlined.
              isOn
                ? "text-energy"
                : "text-muted underline decoration-1 underline-offset-4 aria-disabled:cursor-default aria-disabled:no-underline not-aria-disabled:pointed:text-ink",
            )}
          >
            {energyLabelOf(level)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The bar over the plan: the day's energy and the view's switch, held at the screen's top while
 * the plan scrolls. On the chart the chart's own scale is held, so the bar stands still there and
 * the energy's words leave it, room and all. Where the bar breaks in two, on a narrow phone, its
 * rows stand 16 px apart, twice a target's reach, so the two rows' targets meet and never cross.
 */
export function PlanBar({
  energy,
  isEnabled,
  onChoose,
  ref,
  className,
}: {
  energy: EnergyLevel;
  isEnabled: boolean;
  onChoose: (energy: EnergyLevel) => void;
  ref?: Ref<HTMLDivElement>;
  className?: string;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "z-10 mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-4 bg-ground view-read:sticky view-read:top-0 view-read:border-b view-read:border-line view-read:py-1",
        className,
      )}
    >
      <PlanEnergy
        energy={energy}
        isEnabled={isEnabled}
        onChoose={onChoose}
        className="view-chart:hidden"
      />
      <DayViewSwitch className="ml-auto" />
    </div>
  );
}
