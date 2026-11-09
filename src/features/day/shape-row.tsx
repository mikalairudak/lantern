import type { ReactNode } from "react";
import type { EnergyLevel } from "@/lib/schema/itinerary.schema";
import { DayShape } from "./day-shape";

interface ShapeRowProps {
  /** Each stop's energy as the day shows it, so far: the beads of its shape. */
  energies: readonly EnergyLevel[];
  /** The day in words, underlined as a link is. */
  words: ReactNode;
  /** Under the words, quieter: a start's country, or how one of the visitor's days stands. */
  under: ReactNode;
  onPress: () => void;
}

/**
 * A day offered on the start screen: the shape of the day, and beside it the day in words,
 * with a quieter line under them. The whole of it is one button, ringed for the keyboard, so
 * the shape is pressed as the words are; only the words are underlined, since the button's
 * own underline would run under the line beneath them too.
 */
export function ShapeRow({ energies, words, under, onPress }: ShapeRowProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="group flex items-start gap-3 rounded-sm text-left focus-ring"
    >
      <DayShape energies={energies} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="type-voice text-quote text-pretty text-ink underline decoration-1 underline-offset-4 transition-colors group-hover:text-energy">
          {words}
        </span>
        {/* Heard as a pause before the line under, which the column sets on its own. */}
        <span className="sr-only">.</span> <span className="type-note text-muted">{under}</span>
      </span>
    </button>
  );
}
