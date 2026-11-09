import type { DayEnd, DayStart, Stop } from "@/lib/schema/itinerary.schema";
import { ICON_PX, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import { runningSpans } from "@/lib/time/clock";
import { MAX_ENERGY } from "./curve";

/** A bead's pointer target: 24px across, the WCAG minimum. */
const BEAD_HIT_RADIUS = 12;
/** Between the liveliest beads' targets and the chart's edge. */
const EDGE_CLEARANCE = 4;
/** The sun on the time axis: an icon at its smallest. */
const SUN_MARK = ICON_PX.xs;
/** A ring around the point where the curve would be grabbed, clear of the shown bead. */
const KNOB_RADIUS = 9;

/**
 * Where things sit in the chart, and how large its marks are drawn, in CSS pixels at the
 * root's default 16 px. Time runs down, energy runs across. These are SVG coordinates for
 * one drawing rather than theme values, so they are named here instead of becoming tokens.
 * A root that grows scales every one of them by its size over 16 (`drawingAt`), so the
 * drawing grows with the type beside it; only the hairlines (`HAIRLINE`) stay as drawn.
 */
export const CHART = {
  /** Hour labels and the time axis. */
  axisWidth: 52,
  /** From the time axis to the reflective lane. */
  laneInsetStart: 28,
  /** From the social lane to the edge: the beads' own reach. */
  laneInsetEnd: BEAD_HIT_RADIUS + EDGE_CLEARANCE,
  /** The band above the plot for the energy labels. */
  top: 40,
  bottom: 20,
  /** A candidate the stop does not show: a hollow ring. */
  beadRadius: 4.5,
  /** The candidate the stop shows: a filled bead, a size up from the others. */
  shownBeadRadius: 6,
  /**
   * A ground stroke painted under the shown bead's fill, so only its outer half shows: a
   * 2px halo that lets the curve and the wire pass under the bead.
   */
  shownBeadHalo: 4,
  /** The ring of a bead: one not shown, the shown one before it fills, and a named one. */
  ringStroke: ICON_STROKE_WIDTH,
  beadHitRadius: BEAD_HIT_RADIUS,
  knobRadius: KNOB_RADIUS,
  knobStroke: 2,
  /**
   * How far a stop's beads reach either side of its wire, the ring of a named bead the
   * widest: the band an open sheet's edge must not cut in half.
   */
  beadReach: KNOB_RADIUS + 1,
  /**
   * Versions at one energy sit this far apart on the wire, a whole pointer target apart, so each
   * keeps its own 24 px circle (WCAG 2.5.8) rather than half the ground between them: a twin's
   * target was 19.5 px wide at 15 px apart. A stop has three versions at most, so a third at one
   * energy, two steps in, has the wire to itself, and at 390 px a twin stands 41.5 px from a
   * version at the energy next to it. Closer than 15 px, a shown bead's halo cut a ring to a "C"
   * that read as a slip.
   */
  twinStep: 24,
  /** Shorter than this, the chart is not drawn to the container but scrolls. */
  minHeight: 400,
  /** A tap this close to a wire, off its beads, names its stop. */
  wireReach: 16,
  /** The energy curve. */
  curveStroke: 2.5,
  /** How far the curve takes to step back and come out again at the edge of a line of words. */
  underWordsSoftness: 2,
  /** The tick on the time axis where the pen is, in a silence. */
  penTick: 6,
  hourTick: 4,
  laneTick: 5,
  /** The energy words' baseline sits this far above the plot. */
  energyLabelRise: 18,
  /** A stop's span on the axis, while it is hovered or open. */
  spanStroke: 2,
  /** The axis through golden hour: a lamp's stroke, a little wider than a stop's span. */
  goldenStroke: 2.5,
  /**
   * The axis from sunset to sunrise: round dots this wide, this far apart, centre to centre.
   * A dot is a dash of no length with round ends.
   */
  dotStroke: 1.5,
  dotPitch: 4,
  /** The sun where it rises or sets on the time axis. */
  sunMark: SUN_MARK,
  /** A disc of the ground behind a sun on the axis, so the axis stops short of it. */
  sunHalo: SUN_MARK / 2 + 1,
} as const;

/** The chart's pixels as one drawing sets them: `CHART` at the default root, or scaled. */
export type ChartSizes = { readonly [Key in keyof typeof CHART]: number };

/**
 * The drawing's hairlines: the wires, the time axis and its ticks. A pixel at any root, so
 * they stay as crisp as the page's own rules.
 */
export const HAIRLINE = 1;

const MINUTES_PER_HOUR = 60;
/** Far under a pixel at any pace, and far over a float's error in a count of hours. */
const HOUR_ROUNDING = 1e-6;

export interface ChartScale {
  /** The pixels this chart is drawn at. */
  chart: ChartSizes;
  width: number;
  height: number;
  axisX: number;
  laneStep: number;
  plotTop: number;
  plotBottom: number;
  dayStart: number;
  dayEnd: number;
  xOf: (energy: number) => number;
  yOf: (minutes: number) => number;
  minutesAt: (y: number) => number;
}

/** A stretch of the day, in minutes from midnight. */
export interface DaySpan {
  start: number;
  end: number;
}

const WHOLE_DAY: DaySpan = { start: 0, end: 24 * MINUTES_PER_HOUR };

/** The hour each word of the request opens the chart's frame on, before any stop lands. */
const ASKED_START: Readonly<Record<DayStart, number>> = {
  early: 7 * MINUTES_PER_HOUR,
  slow: 9 * MINUTES_PER_HOUR,
};
/** The hour each word of the request closes the chart's frame on. */
const ASKED_END: Readonly<Record<DayEnd, number>> = {
  evening: 20 * MINUTES_PER_HOUR,
  early: 23 * MINUTES_PER_HOUR,
  late: 24 * MINUTES_PER_HOUR,
};

function isDayEnd(end: string | null): end is DayEnd {
  return end !== null && Object.hasOwn(ASKED_END, end);
}

/**
 * The hours a day's words ask for, which the page frames its chart on: from the start they
 * name to the hour they end by. A word not answered yet frames as the early one. The page
 * and the lab's cells read them here, so a cell's frame is the page's.
 */
export function askedHoursOf(start: string | null, end: string | null): DaySpan {
  return {
    start: start === "slow" ? ASKED_START.slow : ASKED_START.early,
    end: isDayEnd(end) ? ASKED_END[end] : ASKED_END.early,
  };
}

/**
 * The chart's span of the day: the hours the visitor asked for, stretched to whole hours
 * around any stop that falls outside them. Without a request, the stops alone set it.
 */
export function dayBounds(
  stops: readonly Pick<Stop, "startTime" | "durationMinutes">[],
  requested?: DaySpan,
): DaySpan {
  if (stops.length === 0) return requested ?? WHOLE_DAY;
  // Running minutes, so a night that goes past midnight stretches the chart past 24:00.
  const spans = runningSpans(stops);
  const starts = spans.map((span) => span.from);
  const ends = spans.map((span) => span.to);
  const start = Math.floor(Math.min(...starts) / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
  const end = Math.ceil(Math.max(...ends) / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
  if (!requested) return { start, end };
  return { start: Math.min(start, requested.start), end: Math.max(end, requested.end) };
}

/** What a chart draws besides its time: the energy scale over the plot and the inset under it. */
function frameInsetsOf(chart: ChartSizes): number {
  return chart.top + chart.bottom;
}

/** The frame's insets at the default root. */
export const FRAME_INSETS = frameInsetsOf(CHART);

/**
 * How many pixels a minute takes on a chart that fits `span` into a day `dayHeight` tall,
 * never shorter than the chart's least: the pace time runs at down the chart.
 */
export function paceOf(span: DaySpan, dayHeight: number, chart: ChartSizes = CHART): number {
  return (Math.max(chart.minHeight, dayHeight) - frameInsetsOf(chart)) / (span.end - span.start);
}

/** How tall a chart of `span` stands with time running at `pace`, before its rows stretch it. */
export function basisAtPaceOf(span: DaySpan, pace: number, chart: ChartSizes = CHART): number {
  return frameInsetsOf(chart) + pace * (span.end - span.start);
}

/**
 * Where a whole day's frame ends: on the whole hour after its last visit, as it starts on the
 * whole hour before its first, rather than at the hour its words asked to end by, which can
 * leave hours of empty frame under the last stop. Time keeps the pace `asked` set, so no row
 * moves, and the frame runs on at least to the whole hour that keeps it as tall as the
 * chart's least; never past `asked`. A stop's times are the stop's, whichever of its versions
 * it shows, so every plan a re-pick of the energy can show ends at the same minute.
 */
export function wholeDayEndOf(
  stops: readonly Pick<Stop, "startTime" | "durationMinutes">[],
  asked: DaySpan,
  pace: number,
  chart: ChartSizes = CHART,
): number {
  if (stops.length === 0 || pace <= 0) return asked.end;
  // A whole number of hours that a float makes a hair longer is still that many.
  const leastHours =
    (chart.minHeight - frameInsetsOf(chart)) / pace / MINUTES_PER_HOUR - HOUR_ROUNDING;
  const leastEnd = asked.start + Math.ceil(leastHours) * MINUTES_PER_HOUR;
  return Math.min(asked.end, Math.max(dayBounds(stops).end, leastEnd));
}

/**
 * Where a version's bead sits, as an energy: its own, moved a bead's width toward the
 * middle of the scale for each version before it at that energy (`twinRankOf`), so twins
 * touch on the wire instead of one hiding under the other.
 */
export function drawnEnergyOf(
  scale: Pick<ChartScale, "laneStep" | "chart">,
  energy: number,
  twinRank: number,
): number {
  if (twinRank === 0 || scale.laneStep <= 0) return energy;
  const inward = energy <= MAX_ENERGY / 2 ? 1 : -1;
  return energy + (inward * twinRank * scale.chart.twinStep) / scale.laneStep;
}

/**
 * A bead's pointer target: a circle, cut where it meets the target of a bead closer than a
 * target's width, so beads that touch split the ground between them instead of one taking
 * the other's.
 */
export function beadTargetPath(
  x: number,
  y: number,
  neighbours: readonly number[],
  radius: number = CHART.beadHitRadius,
): string {
  const near = neighbours.filter((each) => Math.abs(each - x) < radius * 2);
  const right = Math.min(
    x + radius,
    ...near.filter((each) => each > x).map((each) => (x + each) / 2),
  );
  const left = Math.max(
    x - radius,
    ...near.filter((each) => each <= x).map((each) => (x + each) / 2),
  );
  const rise = (edge: number) => Math.sqrt(Math.max(0, radius ** 2 - (edge - x) ** 2));
  const fix = (value: number) => value.toFixed(1);
  // Over the top from the right edge to the left, down the left edge, under the bottom
  // back to the right: counterclockwise on screen, each arc under half a turn.
  return [
    `M${fix(right)} ${fix(y - rise(right))}`,
    `A${radius} ${radius} 0 0 0 ${fix(left)} ${fix(y - rise(left))}`,
    `L${fix(left)} ${fix(y + rise(left))}`,
    `A${radius} ${radius} 0 0 0 ${fix(right)} ${fix(y + rise(right))}`,
    "Z",
  ].join(" ");
}

/** Maps time and energy to pixels for a chart of this size, drawn at `chart`'s pixels. */
export function chartScale(
  width: number,
  height: number,
  dayStart: number,
  dayEnd: number,
  chart: ChartSizes = CHART,
): ChartScale {
  const laneLeft = chart.axisWidth + chart.laneInsetStart;
  const laneRight = width - chart.laneInsetEnd;
  const laneStep = (laneRight - laneLeft) / MAX_ENERGY;
  const plotTop = chart.top;
  const plotBottom = height - chart.bottom;
  const perMinute = (plotBottom - plotTop) / (dayEnd - dayStart);
  return {
    chart,
    width,
    height,
    axisX: chart.axisWidth,
    laneStep,
    plotTop,
    plotBottom,
    dayStart,
    dayEnd,
    xOf: (energy) => laneLeft + laneStep * energy,
    yOf: (minutes) => plotTop + (minutes - dayStart) * perMinute,
    minutesAt: (y) => dayStart + (y - plotTop) / perMinute,
  };
}

/** Every whole hour of the chart's day, for the unlabelled ticks on the time axis. */
export function hourMarks(dayStart: number, dayEnd: number): number[] {
  const count = Math.floor((dayEnd - dayStart) / MINUTES_PER_HOUR) + 1;
  return Array.from({ length: count }, (_, index) => dayStart + index * MINUTES_PER_HOUR);
}

/** An SVG path through points, to a tenth of a pixel. */
export function polylinePath(points: readonly { x: number; y: number }[]): string {
  return points
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
}
