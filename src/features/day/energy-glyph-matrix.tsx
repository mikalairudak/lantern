import { cn } from "@/components/ui/cn";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { ENERGY_LEVELS, type EnergyLevel } from "@/lib/schema/itinerary.schema";
import { EnergyGlyph } from "./energy-glyph";
import { energyLabelOf } from "./sentence";

type GlyphSize = "word" | "row";
type BeadTone = "day" | "other" | "pointed";

interface EnergyGlyphCellProps {
  level: EnergyLevel;
  size: GlyphSize;
  tone: BeadTone;
}

/**
 * Where the glyph stands: after a 13 px word, 6 px on, as the bar's word would set it; and at
 * the end of a 17 px name's line in a row of the energy word's list, on the list's sheet.
 */
const SIZE_CLASSES: Readonly<Record<GlyphSize, string>> = {
  word: "type-note gap-1.5",
  row: "type-voice text-quote gap-4 bg-surface px-3 py-1",
};

/** The words' colour, which the bead takes unless it is the day's. */
const TONE_CLASSES: Readonly<Record<BeadTone, Record<GlyphSize, string>>> = {
  day: { word: "text-energy", row: "text-ink" },
  other: { word: "text-muted", row: "text-muted" },
  pointed: { word: "text-ink", row: "text-ink" },
};

/**
 * The energy's scale glyph (`docs/decisions.md`, "The energy's scale is drawn as one of the
 * chart's wires"): each of the five levels, at a word's size and a list row's, its bead the
 * day's in energy, another level's in its name's muted, and a pointed row's in ink.
 */
export const ENERGY_GLYPH_MATRIX: LabMatrix = labMatrix<EnergyGlyphCellProps>({
  key: "energy-glyph",
  title: "The energy's scale glyph",
  note: "A wire with five places, quiet to social: the level's bead filled, the other places open rings",
  base: { level: "calm", size: "word", tone: "day" },
  axes: [
    {
      name: "level",
      values: ENERGY_LEVELS.map((level) => ({ label: energyLabelOf(level), props: { level } })),
    },
    {
      name: "size",
      values: [
        { label: "beside a 13 px word", props: { size: "word" } },
        { label: "in a list's row, 17 px", props: { size: "row" } },
      ],
    },
    {
      name: "bead",
      values: [
        { label: "the day's", props: { tone: "day" } },
        { label: "another level's", props: { tone: "other" } },
        { label: "pointed at", props: { tone: "pointed" } },
      ],
    },
  ],
  render: ({ level, size, tone }) => (
    <span
      className={cn("inline-flex items-baseline", SIZE_CLASSES[size], TONE_CLASSES[tone][size])}
    >
      <span>{energyLabelOf(level)}</span>
      <span>
        <EnergyGlyph level={level} isDayLevel={tone === "day"} />
      </span>
    </span>
  ),
});
