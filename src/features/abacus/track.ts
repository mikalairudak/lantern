import { SAMPLES_PER_SEGMENT, hermiteAt, monotoneSlopes, type CurveSample } from "./curve";

/**
 * The curve while the day is written: it passes through each stop whose bead has filled,
 * and it never changes shape in a single frame. When a stop joins, the bend at the stop
 * before eases from an end into a turn between two neighbours, and the new stretch grows
 * out from that stop along time, both on the joining bead's own spring.
 */

/** A stop on the curve. */
export interface TrackPoint {
  /** The minute the curve passes through the stop. */
  mid: number;
  energy: number;
  /** How much of the stretch from the stop before is drawn, from 0 to 1. */
  grown: number;
  /** How far the bend at the stop before has eased into its shape with this stop, 0 to 1. */
  eased: number;
  /**
   * How much the stop is on the curve, 0 to 1, for a stop that joins or leaves among others,
   * as a re-plan's stops do; 1, or left out, for a stop that is simply on it.
   */
  present?: number;
  /**
   * The curve's slope at the stop, in energy a minute, when a stop joining beside it holds
   * it to the curve as drawn; left out, it is worked out from the stop's neighbours.
   */
  slope?: number;
  /**
   * A stop the re-plan on screen brings, which the day did not have as it began: the curve's
   * ends never rest on it until the merged day takes the page.
   */
  isNew?: boolean;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Slopes at each stop. A stop whose next neighbour is still joining blends from the slope
 * it had as the last stop to the one it has between two neighbours, and the stop after one
 * joining or leaving at the curve's start blends the same way from the slope it has as the
 * first stop. A stop joining or leaving after that one is on the curve through the others,
 * so the stops beyond it keep the slopes they have between two neighbours.
 */
export function trackSlopes(track: readonly TrackPoint[]): number[] {
  const levels = track.map((point) => point.energy);
  const mids = track.map((point) => point.mid);
  const joined = monotoneSlopes(levels, mids);
  return joined.map((slope, index) => {
    const held = track[index]?.slope;
    if (held !== undefined) return held;
    const eased = clampUnit(track[index + 1]?.eased ?? 1);
    const asEnd =
      eased >= 1
        ? slope
        : (monotoneSlopes(levels.slice(0, index + 1), mids.slice(0, index + 1))[index] ?? 0);
    const ended = asEnd + (slope - asEnd) * eased;
    // Only the stop after the curve's first, while that one joins or leaves at the start.
    const before = index === 1 ? clampUnit(track[0]?.present ?? 1) : 1;
    if (before >= 1 || (track[index]?.present ?? 1) < 1) return ended;
    const asStart = monotoneSlopes(levels.slice(index), mids.slice(index))[0] ?? 0;
    return asStart + (ended - asStart) * before;
  });
}

/** A stop on its way onto or off the curve below this is off it. */
export const GONE = 0.001;

/** The curve's stops as drawn this frame, and the span of minutes drawn when it is cut. */
export interface PresentTrack {
  track: TrackPoint[];
  /** Where the curve starts when stops at the start are joining or leaving; null otherwise. */
  from: number | null;
  /** Where it ends when stops at the end are leaving; null otherwise. */
  to: number | null;
}

/**
 * The curve with a re-plan's stops joining and leaving among the others without changing
 * its shape in a frame. A stop growing that is not the last joins where it is,
 * its presence how far it has grown, so the rest of the curve stays drawn.
 *
 * The curve's ends rest on the first and last stops the day had as the re-plan began that
 * stand wholly on it (`isNew` marks the others). Every stop before the first of them, or
 * after the last, old or new, draws the curve out from that stop to itself as far as it is
 * there, or back to that stop as it goes: two old stops leaving at the start draw the curve
 * back to the first stop that stays, never to the second that leaves, and a new stop come
 * whole holds its stretch. Every stop coming or going joins the curve one by one, the
 * furthest come first, on the curve as drawn with those come before it, with the curve's
 * height and slope where it comes, until it rises (or sinks back as it goes). So a stop let
 * in, gone, or come whole changes nothing in a frame. A stop gone is off the curve.
 */
export function presentTrack(points: readonly TrackPoint[]): PresentTrack {
  const lastIndex = points.length - 1;
  const live = points
    .map((point, index) =>
      index < lastIndex && point.grown < 1
        ? {
            ...point,
            present: Math.min(point.present ?? 1, clampUnit(point.grown)),
            grown: 1,
            eased: 1,
          }
        : point,
    )
    .filter((point) => (point.present ?? 1) > GONE);
  const presentOf = (point: TrackPoint): number => point.present ?? 1;
  const isPartial = (point: TrackPoint): boolean => presentOf(point) < 1;
  const isKept = (point: TrackPoint): boolean => !isPartial(point) && !point.isNew;
  const firstKept = live.findIndex(isKept);
  const lastKept = live.length - 1 - [...live].reverse().findIndex(isKept);
  const start = live[firstKept];
  const end = live[lastKept];
  if (!start || !end || !live.some((point) => isPartial(point) || point.isNew)) {
    return { track: live, from: null, to: null };
  }
  const before = live.slice(0, firstKept);
  const after = live.slice(lastKept + 1);
  // Each stop of an end's chain, from the one nearest the stop that stays outward, draws the
  // curve from where those inside it have drawn it to itself, as far as it is there: so a
  // stop come whole draws the curve right to itself, and its turn to be the end changes
  // nothing. The day's last stop still growing reaches as far as it has grown.
  const reachOf = (point: TrackPoint): number =>
    point === live.at(-1) && point.grown < 1 ? clampUnit(point.grown) : presentOf(point);
  const from =
    before.length === 0
      ? null
      : before.reduceRight(
          (reach, point) => reach - (reach - point.mid) * presentOf(point),
          start.mid,
        );
  const to =
    after.length === 0
      ? null
      : after.reduce((reach, point) => reach + (point.mid - reach) * reachOf(point), end.mid);
  // The stops coming or going join the curve one by one, the furthest come first, each on
  // the curve as drawn with those before it: a second new stop let in while the first still
  // rises starts where the curve is drawn, the first's rise and all.
  const among = live
    .flatMap((point, index) => (isPartial(point) ? [index] : []))
    .sort((a, b) => presentOf(live[b] as TrackPoint) - presentOf(live[a] as TrackPoint));
  if (among.length === 0) return { track: live, from, to };
  // The curve drawn so far, by stop, each with the slope it is drawn with.
  let drawn = new Map(
    live.flatMap((point, index) => (among.includes(index) ? [] : [[index, point] as const])),
  );
  drawn = withSlopes(drawn);
  for (const index of among) {
    const point = live[index];
    if (!point) continue;
    const curve = [...drawn.values()];
    const present = point.present ?? 1;
    const through = trackAt(curve, point.mid);
    const throughSlope =
      (trackAt(curve, point.mid + SLOPE_SPAN) - trackAt(curve, point.mid - SLOPE_SPAN)) /
      (2 * SLOPE_SPAN);
    const next = new Map<number, TrackPoint>(
      [...drawn, [index, point] as const].sort(([a], [b]) => a - b),
    );
    // As it joins, the stop takes the curve's height and slope where it comes, and its
    // neighbours keep theirs: a cubic cut where it passes, with its own height and slope
    // there, is the same cubic, so the curve keeps its shape until the stop rises.
    const unheld = new Map(
      [...next].map(([at, stop]) => [
        at,
        at === index
          ? { ...stop, energy: through + (stop.energy - through) * present, slope: undefined }
          : { ...stop, slope: undefined },
      ]),
    );
    const worked = trackSlopes([...unheld.values()]);
    const order = [...unheld.keys()];
    const place = order.indexOf(index);
    drawn = new Map(
      order.map((at, k) => {
        const stop = unheld.get(at) as TrackPoint;
        const was = drawn.get(at)?.slope ?? 0;
        const isBeside = k === place - 1 || k === place + 1;
        const slope = worked[k] ?? 0;
        if (at === index) return [at, { ...stop, slope: lerp(throughSlope, slope, present) }];
        return [at, { ...stop, slope: isBeside ? lerp(was, slope, present) : was }];
      }),
    );
  }
  return { track: [...drawn.values()], from, to };
}

/** Half the span of minutes the curve's slope is read over where a stop joins it. */
const SLOPE_SPAN = 0.5;

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/** The stops with the slopes they are drawn with, each held where the curve holds it. */
function withSlopes(points: ReadonlyMap<number, TrackPoint>): Map<number, TrackPoint> {
  const slopes = trackSlopes([...points.values()]);
  return new Map([...points].map(([at, point], k) => [at, { ...point, slope: slopes[k] ?? 0 }]));
}

/** Samples cut to the minutes drawn, with the curve's own point where each cut falls. */
export function samplesWithin(
  track: readonly TrackPoint[],
  samples: readonly CurveSample[],
  from: number | null,
  to: number | null,
): CurveSample[] {
  // A cut past what is drawn cuts nothing: a new last stop still growing ends the curve
  // where it has grown to, however far its stretch reaches.
  const first = samples[0]?.minutes ?? -Infinity;
  const last = samples.at(-1)?.minutes ?? Infinity;
  const start = from !== null && from > first ? from : null;
  const end = to !== null && to < last ? to : null;
  if (start === null && end === null) return [...samples];
  const inside = samples.filter(
    (sample) =>
      (start === null || sample.minutes > start) && (end === null || sample.minutes < end),
  );
  const edge = (minutes: number): CurveSample => ({ minutes, energy: trackAt(track, minutes) });
  return [
    ...(start === null ? [] : [edge(start)]),
    ...inside,
    ...(end === null ? [] : [edge(end)]),
  ];
}

/** Energy along the curve at any minute, with the bends as they are now. */
export function trackAt(track: readonly TrackPoint[], minutes: number): number {
  return hermiteAt(
    track.map((point) => point.energy),
    track.map((point) => point.mid),
    trackSlopes(track),
    minutes,
  );
}

/**
 * Points along the curve from the first stop to as far as it has grown, for drawing it.
 * A stretch still growing is the last one drawn: the curve never has gaps.
 */
export function sampleTrack(track: readonly TrackPoint[]): CurveSample[] {
  const first = track[0];
  if (!first) return [];
  const levels = track.map((point) => point.energy);
  const mids = track.map((point) => point.mid);
  const slopes = trackSlopes(track);
  const samples: CurveSample[] = [{ minutes: first.mid, energy: first.energy }];
  for (const [index, point] of track.entries()) {
    if (index === 0) continue;
    const grown = clampUnit(point.grown);
    if (grown <= 0) break;
    const from = mids[index - 1] ?? point.mid;
    const end = from + (point.mid - from) * grown;
    const steps = Math.ceil(SAMPLES_PER_SEGMENT * grown);
    for (let step = 1; step <= steps; step += 1) {
      const minutes = from + ((end - from) * step) / steps;
      samples.push({ minutes, energy: hermiteAt(levels, mids, slopes, minutes) });
    }
    if (grown < 1) break;
  }
  return samples;
}
