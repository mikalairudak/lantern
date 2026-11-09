import { ENERGY_LEVELS, type EnergyLevel, type Itinerary } from "@/lib/schema/itinerary.schema";

/**
 * The sizes of a day's shape, in px: the chart in small. Five lanes of energy across, the
 * stops down in their order, one bead each, and the curve through them; ticks over the lanes
 * stand for the chart's scale. A day of eight stops is 54 × 90.
 */
export const DAY_SHAPE = {
  width: 54,
  /** The reflective lane's x; each lane after it is `laneStep` further. */
  firstLane: 5,
  laneStep: 11,
  /** The first bead's y; the ticks stand above it. */
  top: 10,
  /** From one stop's bead to the next. */
  stopStep: 10,
  tickFrom: 1,
  tickTo: 4,
  tickStroke: 1,
  curveStroke: 2,
  beadRadius: 3,
} as const;

/** The x of each energy lane, reflective first. */
const LANES = ENERGY_LEVELS.map((_, lane) => DAY_SHAPE.firstLane + lane * DAY_SHAPE.laneStep);

interface Point {
  x: number;
  y: number;
}

/** The energy of each stop's place as the day shows it, in the day's order. */
export function shownEnergiesOf(itinerary: Pick<Itinerary, "stops">): EnergyLevel[] {
  return itinerary.stops.map((stop) => {
    const shown = [stop.primary, ...stop.alternatives].find(
      (place) => place.id === stop.selectedPlaceId,
    );
    return (shown ?? stop.primary).sensory.energy;
  });
}

/** Each stop's bead: its energy's lane across, its place in the day down. */
export function shapePointsOf(energies: readonly EnergyLevel[]): Point[] {
  return energies.map((energy, index) => ({
    x: LANES[ENERGY_LEVELS.indexOf(energy)] ?? DAY_SHAPE.firstLane,
    y: DAY_SHAPE.top + index * DAY_SHAPE.stopStep,
  }));
}

/** The curve through the beads, each bend leaving and reaching a bead straight down. */
export function shapeCurveOf(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (!first) return "";
  let last = first;
  const bends = rest.map((point) => {
    const middle = (last.y + point.y) / 2;
    const bend = `C${last.x} ${middle} ${point.x} ${middle} ${point.x} ${point.y}`;
    last = point;
    return bend;
  });
  return [`M${first.x} ${first.y}`, ...bends].join(" ");
}

/** How tall a day's shape is: its stops, and the same room above the first and below the last. */
export function shapeHeightOf(stops: number): number {
  return DAY_SHAPE.top * 2 + DAY_SHAPE.stopStep * Math.max(0, stops - 1);
}

/**
 * A written day's shape, so a start says how its day moves before a word of it is read: a
 * lively day leans right, a quiet one left. Drawn from the day the start opens, its beads the
 * places the day shows (`shownEnergiesOf`). It says nothing a reader needs: the words beside
 * it say the energy.
 */
export function DayShape({ energies }: { energies: readonly EnergyLevel[] }) {
  const points = shapePointsOf(energies);
  const height = shapeHeightOf(points.length);
  return (
    <svg
      aria-hidden
      width={DAY_SHAPE.width}
      height={height}
      viewBox={`0 0 ${DAY_SHAPE.width} ${height}`}
      className="block shrink-0"
    >
      {LANES.map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={DAY_SHAPE.tickFrom}
          y2={DAY_SHAPE.tickTo}
          strokeWidth={DAY_SHAPE.tickStroke}
          className="stroke-muted"
        />
      ))}
      <path
        d={shapeCurveOf(points)}
        strokeWidth={DAY_SHAPE.curveStroke}
        strokeLinecap="round"
        className="fill-none stroke-curve"
      />
      {points.map(({ x, y }) => (
        <circle key={y} cx={x} cy={y} r={DAY_SHAPE.beadRadius} className="fill-ink" />
      ))}
    </svg>
  );
}
