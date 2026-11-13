import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ENERGY_LEVELS, type Stop } from "@/lib/schema/itinerary.schema";
import { DEFAULT_ROOT_PX } from "@/lib/tokens/root";
import { SPRINGS } from "@/lib/tokens/motion";
import { cn } from "@/components/ui/cn";
import { useRootFontPx } from "@/components/ui/use-root-font-px";
import { formatClock, runningSpans } from "@/lib/time/clock";
import { SunMark } from "./best-light-icon";
import { MAX_ENERGY } from "./curve";
import { HAIRLINE, hourMarks, type ChartScale } from "./geometry";
import type { AxisRun, BestLight } from "./light";

const CAPTION_CLASSES = "type-note";

/** Which suns on the axis say their minute beside them in the gutter. */
export type SunLabels = Readonly<Record<BestLight, boolean>>;

const NO_SUN_LABELS: SunLabels = { sunrise: false, sunset: false };

/**
 * How far a sun's glyph reaches from its centre along the axis, as a share of its size: up
 * to its arrow's tail at sunset and down to its horizon at sunrise, 10 of the icon's 24 units.
 */
const SUN_GLYPH_REACH = 10 / 24;

/** The lamp's join starts this far outside the sun's disc, under the run's own end. */
const JOIN_OVERLAP = 1;

/** Which side of a sun the golden run that meets it comes from, down the axis. */
export type GoldenSide = "above" | "below";

/**
 * The side a golden run meets a sun from: one that ends under its disc at sunset comes
 * from above, one that starts under it at sunrise from below; none, if no run reaches it,
 * as while the light comes in with the day.
 */
export function goldenSideOf(
  light: readonly AxisRun[],
  minutes: number,
  scale: Pick<ChartScale, "yOf" | "chart">,
): GoldenSide | null {
  const y = scale.yOf(minutes);
  const isUnderDisc = (minute: number) => Math.abs(scale.yOf(minute) - y) <= scale.chart.sunHalo;
  for (const run of light) {
    if (run.light !== "golden") continue;
    if (run.from < minutes && isUnderDisc(run.to)) return "above";
    if (run.to > minutes && isUnderDisc(run.from)) return "below";
  }
  return null;
}

type TimedStop = Pick<Stop, "id" | "startTime" | "durationMinutes">;

interface ChartAxesProps {
  scale: ChartScale;
  /** Where the axis runs in golden hour, and where from sunset to sunrise; plain elsewhere. */
  light?: readonly AxisRun[];
  /** When the sun rises and sets, in minutes from midnight; null if it does not. */
  sunrise: number | null;
  sunset: number | null;
  /** Which suns say their minute in the gutter, where it keeps clear of the stops' times. */
  sunLabels?: SunLabels;
  /** Where the stops' times end on the right, from the chart's left: a sun's minute ends there. */
  timesRight?: number;
  /** The stops placed so far; each one's start time appears as it arrives. */
  stops: readonly TimedStop[];
  /**
   * Where each stop starts as drawn this frame, in minutes: its own start, or on the way
   * to it while a stop written again glides to a new time. Defaults to the stops' own.
   */
  starts?: readonly number[];
  /** The stops lit: their span lights on the axis. */
  litStops: readonly number[];
  /** Where the axis line starts: up to the parked sun at its head, or the plot's top. */
  axisFrom?: number;
  /**
   * How far down the day the axis and its hours are drawn, in minutes: the day's end unless
   * the day is still written, where nothing empty stands under its rows.
   */
  axisTo?: number;
  /** The scale says what moves along it: "drag the curve", between its two words. */
  isCurveNamed?: boolean;
  /** On a phone its words are the sticky scale's, laid over the chart (`StickyScale`). */
  isScaleHeld?: boolean;
}

/**
 * The time axis and the energy scale. Each stop's start time is its row's, in the gutter
 * where its time begins (`StartTime`). Unlabelled hour ticks keep the scale. The axis
 * carries the light: it runs in the lamp through golden hour and goes dotted from sunset to
 * sunrise, and the sun marks its rising and setting, with its minute beside it where that
 * keeps clear of the stops' times.
 * Duration is not drawn at rest: the list states it, and a hovered or open stop lights its
 * span here.
 */
export function ChartAxes({
  scale,
  light = [],
  sunrise,
  sunset,
  sunLabels = NO_SUN_LABELS,
  timesRight = scale.axisX,
  stops,
  starts = runningSpans(stops).map((span) => span.from),
  litStops,
  axisFrom,
  axisTo = scale.dayEnd,
  isCurveNamed = false,
  isScaleHeld = false,
}: ChartAxesProps) {
  const { axisX, plotTop, plotBottom, yOf, chart } = scale;
  const axisBottom = Math.min(plotBottom, yOf(axisTo));
  const hours = hourMarks(scale.dayStart, scale.dayEnd).filter(
    (minutes) => axisBottom > plotTop && yOf(minutes) <= axisBottom,
  );
  const isLit = (index: number) => litStops.includes(index);
  const fadeIn = useFadeIn();

  return (
    <g aria-hidden>
      <EnergyScale scale={scale} isCurveNamed={isCurveNamed} isHeld={isScaleHeld} />
      {/* The axis rises to the sun at its head as the sun comes out. */}
      <AnimatePresence>
        {axisFrom !== undefined && (
          <motion.line
            key="head"
            {...fadeIn}
            x1={axisX}
            x2={axisX}
            y1={axisFrom}
            y2={plotTop}
            strokeWidth={HAIRLINE}
            className="stroke-line"
          />
        )}
      </AnimatePresence>
      <TimeAxis scale={scale} light={light} axisBottom={axisBottom} />
      {hours.map((minutes) => (
        <line
          key={minutes}
          x1={axisX - chart.hourTick}
          x2={axisX}
          y1={yOf(minutes)}
          y2={yOf(minutes)}
          strokeWidth={HAIRLINE}
          className="stroke-line"
        />
      ))}
      {stops.map((stop, index) => {
        const start = starts[index] ?? 0;
        return (
          <line
            key={stop.id}
            x1={axisX}
            x2={axisX}
            y1={yOf(start)}
            y2={yOf(start + stop.durationMinutes)}
            strokeWidth={chart.spanStroke}
            className={cn(
              "stroke-ink transition-opacity",
              isLit(index) ? "opacity-100" : "opacity-0",
            )}
          />
        );
      })}
      <AxisSun
        light="sunrise"
        minutes={sunrise}
        scale={scale}
        golden={light}
        isLabelled={sunLabels.sunrise}
        labelRight={timesRight}
      />
      <AxisSun
        light="sunset"
        minutes={sunset}
        scale={scale}
        golden={light}
        isLabelled={sunLabels.sunset}
        labelRight={timesRight}
      />
    </g>
  );
}

/** A stretch of the axis, from the top of the chart. */
interface AxisSpan {
  top: number;
  bottom: number;
}

/** The plot's run of the axis less the stretches drawn dotted, top to bottom. */
function plainSpansOf(plot: AxisSpan, dotted: readonly AxisSpan[]): AxisSpan[] {
  const spans: AxisSpan[] = [];
  let top = plot.top;
  for (const gap of dotted) {
    if (gap.top > top) spans.push({ top, bottom: Math.min(gap.top, plot.bottom) });
    top = Math.max(top, gap.bottom);
  }
  if (top < plot.bottom) spans.push({ top, bottom: plot.bottom });
  return spans;
}

interface TimeAxisProps {
  scale: ChartScale;
  light: readonly AxisRun[];
  /** Where the hairline ends, from the top of the chart: as far down as the day is drawn. */
  axisBottom: number;
}

/**
 * The time axis down the plot, carrying the light: a hairline by day, the lamp through
 * golden hour, and dots from sunset to sunrise, in the hairline's place. Each run follows
 * the frame as it springs; none slides.
 */
function TimeAxis({ scale, light, axisBottom }: TimeAxisProps) {
  const { axisX, plotTop, plotBottom, yOf, chart } = scale;
  const spanOf = (run: AxisRun): AxisSpan => ({
    top: Math.max(plotTop, yOf(run.from)),
    bottom: Math.min(plotBottom, yOf(run.to)),
  });
  const dark = light.filter((run) => run.light === "dark");
  const golden = light.filter((run) => run.light === "golden");
  const plain = plainSpansOf({ top: plotTop, bottom: axisBottom }, dark.map(spanOf));
  // A golden run's round ends stay inside its minutes.
  const inset = chart.goldenStroke / 2;
  return (
    <>
      {plain.map(({ top, bottom }, index) => (
        <line
          // The plain stretches only split and join where the dark runs are; by place is enough.
          key={index}
          x1={axisX}
          x2={axisX}
          y1={top}
          y2={bottom}
          strokeWidth={HAIRLINE}
          className="stroke-line"
        />
      ))}
      {dark.map((run) => {
        const { top, bottom } = spanOf(run);
        return (
          <line
            key={`dark:${run.key}`}
            data-light="dark"
            x1={axisX}
            x2={axisX}
            y1={top}
            y2={bottom}
            strokeWidth={chart.dotStroke}
            strokeLinecap="round"
            strokeDasharray={`0 ${chart.dotPitch}`}
            className="stroke-wire"
          />
        );
      })}
      {golden.map((run) => {
        const { top, bottom } = spanOf(run);
        return (
          <line
            key={`golden:${run.key}`}
            data-light="golden"
            x1={axisX}
            x2={axisX}
            y1={top + inset}
            y2={Math.max(top + inset, bottom - inset)}
            strokeWidth={chart.goldenStroke}
            strokeLinecap="round"
            className="stroke-lamp"
          />
        );
      })}
    </>
  );
}

interface AxisSunProps {
  light: BestLight;
  minutes: number | null;
  scale: ChartScale;
  /** The axis's light, for the golden run that meets it. */
  golden: readonly AxisRun[];
  /** Its minute is said beside it, in the gutter of the stops' times. */
  isLabelled: boolean;
  /** Where its minute ends on the right, as a stop's time does. */
  labelRight: number;
}

/**
 * The sun on the time axis at the minute it rises or sets, and that minute beside it in
 * amber, a size under a stop's time, where it keeps clear of them; nothing outside the frame.
 * A disc of the ground keeps the axis off it, but the golden run that meets it goes on over
 * the disc to its glyph, so the light runs into the sunset's arrow and out of the sunrise's
 * horizon: with a gap between them, the run over the sun read as "!".
 */
function AxisSun({ light, minutes, scale, golden, isLabelled, labelRight }: AxisSunProps) {
  const fadeIn = useFadeIn();
  if (minutes === null || minutes < scale.dayStart || minutes > scale.dayEnd) return null;
  const y = scale.yOf(minutes);
  const { sunMark, sunHalo, goldenStroke } = scale.chart;
  const side = goldenSideOf(golden, minutes, scale);
  const direction = side === "above" ? -1 : 1;
  return (
    <g data-sun={light}>
      <circle cx={scale.axisX} cy={y} r={sunHalo} className="fill-ground" />
      {side && (
        <line
          data-sun-join={side}
          x1={scale.axisX}
          x2={scale.axisX}
          y1={y + direction * (sunHalo + JOIN_OVERLAP)}
          y2={y + direction * sunMark * SUN_GLYPH_REACH}
          strokeWidth={goldenStroke}
          className="stroke-lamp"
        />
      )}
      <SunMark
        light={light}
        x={scale.axisX - sunMark / 2}
        y={y - sunMark / 2}
        size={sunMark}
        className="text-lamp"
      />
      <AnimatePresence>
        {isLabelled && (
          <motion.text
            key="minute"
            {...fadeIn}
            x={labelRight}
            y={y}
            textAnchor="end"
            dominantBaseline="central"
            // A size under the stops' times, so the sun's minute is never read as a stop's.
            className="fill-amber text-caption tabular-nums"
          >
            {formatClock(minutes)}
          </motion.text>
        )}
      </AnimatePresence>
    </g>
  );
}

/** What moves along the energy scale, said between its two ends once it can be moved. */
export const CURVE_NAME = "drag the curve";

/**
 * The scale's least span, from the quietest lane to the liveliest, in rems, for its end
 * words to keep their arrows. Centred between them, "drag the curve" (89.0 px in
 * `type-note` at the default size) leaves 12 px, about one em, to "← quieter" (54.8 px, the
 * wider end word) at 2 × (54.8 + 12) + 89.0 = 222.5 px: 13.9375 rems, 223 px. Closer than
 * that, the three read as one phrase. On a phone the span is the viewport less the page's
 * gutters, a rem either side, and the chart's 96 px beside its lanes, which grow only on a
 * large screen: 128 px at the default size, so the arrows go below 351 px; with the
 * browser's text at 125 %, 136 px, and they go below 415 px.
 */
export const SCALE_ARROWS_MIN_REMS = 13.9375;

/**
 * The least span, in rems, for the curve's name to stand between the arrowless end words,
 * 8 px clear of each: centred, "drag the curve" (89.0 px in `type-note` at the default size)
 * and "quieter" (44.7 px, the wider end word) need 2 × (44.7 + 8) + 89.0 = 194.4 px, 12.1875
 * rems, 195 px, over a 320 px phone's 192, so the name first stands on a 323 px phone. Under
 * it, as on a 320 px phone and with the browser's text at 125 % on a phone under 380 px, the
 * scale keeps only "quieter" and "livelier", each on its end lane, and the opening pull's ring
 * still shows what to drag.
 */
export const SCALE_NAME_MIN_REMS = 12.1875;

/**
 * The energy scale: a short tick over each lane, and only its direction in words, quieter
 * to the left and livelier to the right. Each word is aligned to its end lane, so both
 * stay inside the chart on a phone. Between them, in the curve's colour, the scale says what
 * moves along it, so the line to drag is named where it is dragged. On a narrow phone the
 * end words lose their arrows to leave room around the middle one, and on a narrower one,
 * in large text, the middle one too; the span in rems alone decides, so words
 * already on screen never change when the curve's name comes or goes.
 */
function EnergyScale({
  scale,
  isCurveNamed,
  isHeld,
}: {
  scale: ChartScale;
  isCurveNamed: boolean;
  isHeld: boolean;
}) {
  const y = scale.plotTop - scale.chart.energyLabelRise;
  const fadeIn = useFadeIn();
  const { quieter, livelier, hasRoomForName } = useEnergyScaleWords(scale);
  const wordClasses = cn(
    "transition-opacity motion-reduce:transition-none",
    isHeld && PHONE_HIDDEN_CLASSES,
  );
  return (
    <>
      {ENERGY_LEVELS.map((level, energy) => (
        <line
          key={level}
          x1={scale.xOf(energy)}
          x2={scale.xOf(energy)}
          y1={scale.plotTop - scale.chart.laneTick}
          y2={scale.plotTop}
          strokeWidth={HAIRLINE}
          className="stroke-line"
        />
      ))}
      {/* On a phone the scale's words are the sticky scale's, held at the screen's top while the
          chart is in view (`StickyScale`); the chart keeps its ticks. */}
      <text x={scale.xOf(0)} y={y} className={cn(CAPTION_CLASSES, "fill-muted", wordClasses)}>
        {quieter}
      </text>
      <text
        x={scale.xOf(MAX_ENERGY)}
        y={y}
        textAnchor="end"
        className={cn(CAPTION_CLASSES, "fill-muted", wordClasses)}
      >
        {livelier}
      </text>
      <AnimatePresence>
        {isCurveNamed && hasRoomForName && (
          <motion.text
            key="curve"
            {...fadeIn}
            x={scale.xOf(MAX_ENERGY / 2)}
            y={y}
            textAnchor="middle"
            className={cn(CAPTION_CLASSES, "fill-energy", wordClasses)}
          >
            {CURVE_NAME}
          </motion.text>
        )}
      </AnimatePresence>
    </>
  );
}

/** Under a phone's width, where the sticky scale says the scale's words instead. */
const PHONE_HIDDEN_CLASSES = "max-sm:hidden";

/** The energy scale's words for a chart drawn at `scale`, as wide as its root lets them be. */
export interface EnergyScaleWords {
  quieter: string;
  livelier: string;
  /** Whether "drag the curve" stands between them. */
  hasRoomForName: boolean;
}

/**
 * The scale's words: its ends with their arrows where the scale is wide enough, and room for
 * the curve's name. Read as the scale is drawn, so its spans follow the root's size, the
 * browser's own text size included; on the server no name, so a word that might not fit is
 * never sent.
 */
export function useEnergyScaleWords(scale: ChartScale): EnergyScaleWords {
  const rem = useRootFontPx();
  const span = scale.xOf(MAX_ENERGY) - scale.xOf(0);
  const hasArrows = span >= SCALE_ARROWS_MIN_REMS * (rem ?? DEFAULT_ROOT_PX);
  return {
    quieter: hasArrows ? "← quieter" : "quieter",
    livelier: hasArrows ? "livelier →" : "livelier",
    hasRoomForName: rem !== null && span >= SCALE_NAME_MIN_REMS * rem,
  };
}

/**
 * What comes and goes on the axes fades, as the curve's ring does; with reduced motion it is
 * just there.
 */
function useFadeIn() {
  const isReducedMotion = useReducedMotion();
  return isReducedMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: SPRINGS.snappy,
      };
}
