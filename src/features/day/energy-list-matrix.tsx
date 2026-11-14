import { cn } from "@/components/ui/cn";
import { modelPicks, shownPlacesOf } from "@/features/abacus/curve";
import { replanForEnergy, stopsRepickedOf } from "@/features/abacus/replan";
import { writtenDayAt } from "@/lib/days/written/days";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { ENERGY_LEVELS, type EnergyLevel } from "@/lib/schema/itinerary.schema";
import { FACT_OPTIONS } from "./facts";
import { repickLineOf } from "./not-yet";
import { SentenceWord, type OptionView } from "./sentence-word";

/** How many stops each other level re-picks, and the stops on screen. */
interface Repicks {
  day: EnergyLevel;
  changed: Readonly<Partial<Record<EnergyLevel, number>>>;
  stops: number;
}

interface EnergyListCellProps {
  repicks: Repicks;
  /** Set in a 320 px phone's screen, where the list is narrowest. */
  isNarrow: boolean;
}

/** Barcelona's written day as it lands, every level counted by the re-pick its press makes. */
function writtenRepicksOf(slug: string): Repicks {
  const written = writtenDayAt(slug);
  if (!written) throw new Error(`No written day at ${slug}`);
  const { stops } = written.itinerary;
  const landed = shownPlacesOf(stops, modelPicks(stops));
  const requested = ENERGY_LEVELS.indexOf(written.request.energy);
  return {
    day: written.request.energy,
    changed: Object.fromEntries(
      ENERGY_LEVELS.map((level, to) => [
        level,
        stopsRepickedOf(landed, replanForEnergy(stops, requested, to)),
      ]),
    ),
    stops: stops.length,
  };
}

const BARCELONA = writtenRepicksOf("barcelona");
const ignore = () => undefined;

/** The energy word's answers, each other one with its line. */
function optionsOf({ day, changed, stops }: Repicks): OptionView[] {
  return FACT_OPTIONS.energy.map(({ value, label }) => ({
    value,
    label,
    isCurrent: value === day,
    consequence: value === day ? null : repickLineOf(changed[value as EnergyLevel] ?? 0, stops),
    energyLevel: value as EnergyLevel,
  }));
}

/**
 * The energy word's list, open (`docs/decisions.md`, "A changed word proposes its part beside
 * the day, and the visitor takes it"): under each answer, how many of the stops on screen it
 * re-picks, counted from the re-pick its press makes. Barcelona as written, then the line at
 * each value: one stop, several, a count past nine, every stop, none, and a day of one stop.
 * The rows a finger gets are taller; a phone shows them, not a cell.
 */
export const ENERGY_LIST_MATRIX: LabMatrix = labMatrix<EnergyListCellProps>({
  key: "energy-list",
  title: "The energy word's list",
  note: "Under each answer, the stops it re-picks on the day on screen: none, one, several, past nine, every stop",
  base: { repicks: BARCELONA, isNarrow: false },
  axes: [
    {
      name: "line",
      values: [
        { label: "Barcelona as written", props: { repicks: BARCELONA } },
        {
          label: "at the extremes: one, 11, every stop, none",
          props: {
            repicks: {
              day: "balanced",
              changed: { reflective: 1, calm: 11, lively: 12, social: 0 },
              stops: 12,
            },
          },
        },
        {
          label: "several, the longest words",
          props: {
            repicks: {
              day: "balanced",
              changed: { reflective: 7, calm: 8, lively: 3, social: 2 },
              stops: 9,
            },
          },
        },
        {
          label: "none: each level gives the same day",
          props: {
            repicks: {
              day: "calm",
              changed: { reflective: 0, balanced: 0, lively: 0, social: 0 },
              stops: 4,
            },
          },
        },
        {
          label: "a day of one stop",
          props: {
            repicks: {
              day: "balanced",
              changed: { reflective: 1, calm: 0, lively: 0, social: 1 },
              stops: 1,
            },
          },
        },
      ],
    },
    {
      name: "phone",
      values: [
        { label: "as wide as the cell", props: { isNarrow: false } },
        { label: "in 320 px", props: { isNarrow: true } },
      ],
    },
  ],
  // A 320 px screen is a container of its own, as the cell is, so the list keeps to its width
  // less the gutters, as on a phone of that size.
  render: ({ repicks, isNarrow }) => (
    <div className={cn(isNarrow && "@container max-w-intro")}>
      <div className={cn("pt-6 pb-day", isNarrow && "px-4")}>
        <div className="type-voice text-title text-pretty text-ink-soft">
          A{" "}
          <SentenceWord
            view={{
              key: "energy",
              label: FACT_OPTIONS.energy.find(({ value }) => value === repicks.day)?.label ?? "",
              source: "chosen",
              struck: null,
              options: optionsOf(repicks),
              listLabel: "The day's energy",
            }}
            isEnabled
            isDrawnOpen
            onChoose={ignore}
            onLight={ignore}
          />{" "}
          <span className="text-ink">Saturday</span> in Barcelona
        </div>
      </div>
    </div>
  ),
});
