import { cn } from "@/components/ui/cn";
import { X_HEIGHT_EM } from "@/components/ui/lantern-mark";
import { ENERGY_LEVELS, type EnergyLevel } from "@/lib/schema/itinerary.schema";

/*
 * The energy's scale, small: one wire of the chart with its five places, quiet at the left and
 * social at the right, the level's place a filled bead and the other four open rings
 * (`docs/decisions.md`, "The energy's scale is drawn as one of the chart's wires"). It runs
 * across, as energy does on the chart, where height is the hour. Its measures are the
 * drawing's own, in units of a thirteenth of the word beside it: a pixel beside a 13 px word.
 */

/** Units to an em of the word the glyph stands beside. */
const UNITS_PER_EM = 13;
const BOX_WIDTH = 30;
const BOX_HEIGHT = 8;
/** The five places' centres along the wire, quiet first, 6 units apart. */
const FIRST_PLACE = 3;
const PLACE_STEP = 6;
export const PLACES = ENERGY_LEVELS.map((_, index) => FIRST_PLACE + index * PLACE_STEP);
/** The wire and the rings' stroke. */
const STROKE = 1;
/** A ring is 4 units across over all: its radius runs to the middle of its stroke. */
const RING_RADIUS = 1.5;
const RING_REACH = RING_RADIUS + STROKE / 2;
/** The bead, half as large again as a ring, covers the ring at its place. */
const BEAD_RADIUS = 3;
const WIRE_Y = BOX_HEIGHT / 2;

/** The wire from edge to edge, stopping at each ring's edge so it never runs through one. */
const WIRE = [
  `M0 ${WIRE_Y}`,
  ...PLACES.map((x) => `H${x - RING_REACH} M${x + RING_REACH} ${WIRE_Y}`),
  `H${BOX_WIDTH}`,
].join(" ");

const emOf = (units: number) => `${units / UNITS_PER_EM}em`;

/**
 * Set on the word's baseline, the box sinks so its middle, where the bead's centre stands, is on
 * the middle of the word's x-height, as the mark's bead is.
 */
const BOX_STYLE = {
  width: emOf(BOX_WIDTH),
  height: emOf(BOX_HEIGHT),
  verticalAlign: `${X_HEIGHT_EM / 2 - BOX_HEIGHT / 2 / UNITS_PER_EM}em`,
};

interface EnergyGlyphProps {
  level: EnergyLevel;
  /**
   * The bead is the day's level, in energy's colour. Otherwise it takes the colour of the text
   * it stands in, as a level the day could take does in the list.
   */
  isDayLevel?: boolean;
  className?: string;
}

/**
 * The scale glyph: where a level stands among the five. A mark, not a control: it has no name,
 * since the word beside it names the level, and a press on it is its word's or its row's. The
 * wire and the rings are muted wherever it stands; the bead is filled and the rings open, so
 * the two are told apart by shape where colours are forced.
 */
export function EnergyGlyph({ level, isDayLevel = false, className }: EnergyGlyphProps) {
  const at = PLACES[ENERGY_LEVELS.indexOf(level)] ?? FIRST_PLACE;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}
      style={BOX_STYLE}
      className={cn("inline overflow-visible", className)}
    >
      <path d={WIRE} fill="none" strokeWidth={STROKE} className="stroke-muted" />
      {PLACES.map((x) => (
        <circle
          key={x}
          cx={x}
          cy={WIRE_Y}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
          data-place=""
        />
      ))}
      <circle
        cx={at}
        cy={WIRE_Y}
        r={BEAD_RADIUS}
        className={isDayLevel ? "fill-energy" : "fill-current"}
        data-bead=""
      />
    </svg>
  );
}
