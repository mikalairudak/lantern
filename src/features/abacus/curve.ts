import {
  ENERGY_LEVELS,
  type EnergyLevel,
  type SensoryProfile,
  type Stop,
} from "@/lib/schema/itinerary.schema";
import { runningSpans } from "@/lib/time/clock";

/**
 * The energy curve: what the visitor wants from each part of the day, as a level per
 * stop from 0 (reflective) to 4 (social). Each stop shows the candidate nearest to the
 * curve, so the code picks among the options the model wrote, locally and instantly.
 */

/** Social, the top of the scale. */
export const MAX_ENERGY = ENERGY_LEVELS.length - 1;

/**
 * While the curve is dragged, a stop switches only when another candidate is nearer by
 * this many levels than the one it shows. Without it, a hand resting on the midpoint
 * between two beads makes the shown bead flicker between them.
 */
export const SWITCH_MARGIN = 0.2;

/**
 * How far past the point where a stop switches a pull made for it goes, in energy levels.
 * A hand lets go once the bead hops, so a pull made for one version stops just past it.
 */
const PAST_SWITCH_LEVELS = 0.2;

/** Points per stretch between two stops when the curve is drawn. */
export const SAMPLES_PER_SEGMENT = 24;
/** Energy distances closer than this count as a tie. */
const TIE_EPSILON = 1e-6;

/** A key that moves one stop along its own candidates. */
export type EnergyStep = "quieter" | "livelier" | "quietest" | "liveliest";

export interface CurveSample {
  minutes: number;
  energy: number;
}

/**
 * What the curve reads from a place and a stop. A finished `Stop` has all of it; a stop
 * still being written fits once its energy is known.
 */
export interface Candidate {
  id: string;
  sensory: Pick<SensoryProfile, "energy">;
}

/** The ids a stop chooses between: its places and the one the model selected. */
export interface Selectable<P extends { id: string } = { id: string }> {
  primary: P;
  alternatives: readonly P[];
  selectedPlaceId: string;
}

export interface CurveStop extends Selectable<Candidate> {
  id: string;
  startTime: string;
  durationMinutes: number;
}

/** The place the model chose, then its alternatives. */
export function candidatesOf<P>(stop: { primary: P; alternatives: readonly P[] }): P[] {
  return [stop.primary, ...stop.alternatives];
}

/** Energy as a level from 0, reflective, to 4, social. */
export function energyOf(place: Pick<Candidate, "sensory">): number {
  return ENERGY_LEVELS.indexOf(place.sensory.energy);
}

/** Energy as a level, or null while the stream has not written it. */
export function writtenEnergyOf(place: { sensory?: { energy?: EnergyLevel } }): number | null {
  const energy = place.sensory?.energy;
  return energy === undefined ? null : ENERGY_LEVELS.indexOf(energy);
}

/** A stop as the day's clock sees it. */
type TimedStop = Pick<Stop, "id" | "startTime" | "durationMinutes">;

/**
 * The curve passes through each stop at the middle of its time, counted in the day's
 * running minutes: past midnight the count runs on beyond 24:00, so a stop at 00:15 after
 * a late one sits after it rather than before the morning. Stops come in the day's order.
 */
export function midsOf(stops: readonly TimedStop[]): number[] {
  return runningSpans(stops).map(({ from, to }) => (from + to) / 2);
}

/** One stop's middle, counted after the day's stops before it. */
export function midOf(stops: readonly TimedStop[], stop: TimedStop): number {
  const index = stops.findIndex((each) => each.id === stop.id);
  return midsOf(index === -1 ? [stop] : stops.slice(0, index + 1)).at(-1) ?? 0;
}

function clampEnergy(energy: number): number {
  return Math.min(MAX_ENERGY, Math.max(0, energy));
}

/** What the model chose to show for a stop: its `selectedPlaceId`, as a candidate index. */
export function modelPick(stop: Selectable): number {
  return Math.max(
    0,
    candidatesOf(stop).findIndex((place) => place.id === stop.selectedPlaceId),
  );
}

/** What the model chose to show for each stop. */
export function modelPicks(stops: readonly Selectable[]): number[] {
  return stops.map(modelPick);
}

/** The curve at rest runs through the energy of what each stop shows. */
export function restingCurve(stops: readonly CurveStop[], selected: readonly number[]): number[] {
  return stops.map((stop, index) => {
    const shown = candidatesOf(stop)[selected[index] ?? 0] ?? stop.primary;
    return energyOf(shown);
  });
}

/**
 * The candidate nearest to the desired energy. The stop keeps what it shows unless
 * another candidate is nearer by more than `margin`; among equally near ones the earlier
 * wins, so a same-energy version (kept for other facts, such as rain) never displaces
 * the primary.
 */
export function pickCandidate(
  energies: readonly number[],
  desired: number,
  current: number,
  margin = 0,
): number {
  const distances = energies.map((energy) => Math.abs(energy - desired));
  const nearest = Math.min(...distances);
  const currentDistance = distances[current] ?? Infinity;
  if (currentDistance - nearest <= margin + TIE_EPSILON) return current;
  return distances.findIndex((distance) => Math.abs(distance - nearest) < TIE_EPSILON);
}

/** Which candidate each stop shows for a curve. */
export function pickAll(
  stops: readonly CurveStop[],
  curve: readonly number[],
  selected: readonly number[],
  margin = 0,
): number[] {
  return stops.map((stop, index) =>
    pickCandidate(
      candidatesOf(stop).map(energyOf),
      curve[index] ?? 0,
      selected[index] ?? 0,
      margin,
    ),
  );
}

export type Version = "the original" | "quieter" | "livelier" | "same energy";

/** Each stop's id and the id of the place it shows, by its pick. */
export type ShownPlaces = Readonly<Record<string, string>>;

type Identified = Selectable & { id: string };

/** The place each stop shows, by the stop's id. */
export function shownPlacesOf(stops: readonly Identified[], picks: readonly number[]): ShownPlaces {
  return Object.fromEntries(
    stops.map((stop, index) => [
      stop.id,
      (candidatesOf(stop)[picks[index] ?? 0] ?? stop.primary).id,
    ]),
  );
}

/**
 * Whether every stop shows the place the line about the day was written around: what it
 * showed when the line last changed, or its primary place where the line has said nothing of
 * it. The line names those, whatever a swap, a drag or the energy word has picked since; a
 * re-plan writes the line again, around the day as it then stands.
 */
export function isAsWritten(
  stops: readonly Identified[],
  picks: readonly number[],
  written: ShownPlaces = {},
): boolean {
  const shown = shownPlacesOf(stops, picks);
  return stops.every((stop) => shown[stop.id] === (written[stop.id] ?? stop.primary.id));
}

/** The place the model selected for a stop. */
export function plannedPlace<P extends { id: string }>(stop: Selectable<P>): P {
  return candidatesOf(stop).find((place) => place.id === stop.selectedPlaceId) ?? stop.primary;
}

/** How a candidate relates to the place the model selected, read from their energies. */
export function versionOf(stop: CurveStop, place: Candidate): Version {
  const planned = plannedPlace(stop);
  if (place.id === planned.id) return "the original";
  const difference = energyOf(place) - energyOf(planned);
  if (difference < 0) return "quieter";
  if (difference > 0) return "livelier";
  return "same energy";
}

/** A candidate and its place among the stop's candidates. */
export interface RankedCandidate<P> {
  place: P;
  index: number;
}

/**
 * A stop's candidates from quietest to liveliest, as its beads run along the wire; equal
 * energies keep the model's order. The order never depends on which one is shown.
 */
export function byEnergy<P extends Candidate>(stop: {
  primary: P;
  alternatives: readonly P[];
}): RankedCandidate<P>[] {
  return candidatesOf(stop)
    .map((place, index) => ({ place, index }))
    .sort((a, b) => energyOf(a.place) - energyOf(b.place) || a.index - b.index);
}

/** The energy a key moves a stop to, or null when it has nothing further that way. */
export function stepEnergy(stop: CurveStop, shownIndex: number, step: EnergyStep): number | null {
  const energies = candidatesOf(stop).map(energyOf);
  const shown = energies[shownIndex] ?? energyOf(stop.primary);
  const quieter = energies.filter((energy) => energy < shown);
  const livelier = energies.filter((energy) => energy > shown);
  const choices: Record<EnergyStep, number[]> = {
    quieter: quieter.length ? [Math.max(...quieter)] : [],
    livelier: livelier.length ? [Math.min(...livelier)] : [],
    quietest: quieter.length ? [Math.min(...quieter)] : [],
    liveliest: livelier.length ? [Math.max(...livelier)] : [],
  };
  return choices[step][0] ?? null;
}

/**
 * How many of a stop's versions before this one share its energy. Versions at one energy
 * sit a bead apart on the wire, the first at the energy itself, so each is drawn and can be
 * picked; none hides under another. A version whose energy is not written yet has none.
 */
export function twinRankOf(
  stop: {
    primary: { sensory?: { energy?: EnergyLevel } };
    alternatives: readonly { sensory?: { energy?: EnergyLevel } }[];
  },
  index: number,
): number {
  const energies = candidatesOf(stop).map(writtenEnergyOf);
  const energy = energies[index];
  if (energy === null || energy === undefined) return 0;
  return energies.slice(0, index).filter((each) => each === energy).length;
}

/** What an arrow key does from the shown version: pull the curve, or pick a twin. */
export type KeyStep = { kind: "energy"; energy: number } | { kind: "version"; index: number };

/**
 * The next bead along the wire from the shown one, the way a key points. A bead at another
 * energy is reached by pulling the curve to it; a twin at the same energy, which the curve
 * cannot tell from the shown one, is picked directly. Home and End go to the stop's quietest
 * and liveliest versions, the ends of its slider's range. Null when the wire has nothing
 * further that way.
 */
export function keyStepOf(stop: CurveStop, shownIndex: number, step: EnergyStep): KeyStep | null {
  if (step === "quieter" || step === "livelier") {
    const order = beadOrderOf(stop);
    const at = order.indexOf(shownIndex);
    const next = order[at + (step === "livelier" ? 1 : -1)];
    if (next === undefined) return null;
    const energies = candidatesOf(stop).map(energyOf);
    if (energies[next] === energies[shownIndex]) return { kind: "version", index: next };
  }
  const energy = stepEnergy(stop, shownIndex, step);
  return energy === null ? null : { kind: "energy", energy };
}

/**
 * A stop's versions in the order their beads run along the wire, quietest first. Twins at
 * one energy run toward the middle of the scale, as they are drawn.
 */
export function beadOrderOf(stop: CurveStop): number[] {
  const along = (index: number) => {
    const energy = energyOf(candidatesOf(stop)[index] ?? stop.primary);
    const inward = energy <= MAX_ENERGY / 2 ? 1 : -1;
    return energy + inward * twinRankOf(stop, index) * TWIN_ORDER_STEP;
  };
  return candidatesOf(stop)
    .map((_, index) => index)
    .sort((a, b) => along(a) - along(b));
}

/** Less than a level, so twins sort among themselves and never past another energy. */
const TWIN_ORDER_STEP = 0.01;

/**
 * Where to invite the first drag: the stop nearest the middle of the day that has both a
 * quieter and a livelier version, so the curve has room to move either way. Given which
 * stops can be seen, it keeps to them: the one with room both ways nearest the middle of
 * the day, or else one with a version either way, so on a phone the invitation is where
 * the visitor is looking. With none of them in view it invites as it would anyway.
 */
export function hintStop(
  stops: readonly CurveStop[],
  isSeen: (index: number) => boolean = () => true,
): number {
  const mids = midsOf(stops);
  const middle = ((mids[0] ?? 0) + (mids.at(-1) ?? 0)) / 2;
  const byMiddle = stops
    .map((stop, index) => ({
      index,
      distance: Math.abs((mids[index] ?? 0) - middle),
      hasQuieter: stepEnergy(stop, 0, "quieter") !== null,
      hasLivelier: stepEnergy(stop, 0, "livelier") !== null,
    }))
    .sort((a, b) => a.distance - b.distance);
  const pick =
    byMiddle.find((stop) => isSeen(stop.index) && stop.hasQuieter && stop.hasLivelier) ??
    byMiddle.find((stop) => isSeen(stop.index) && (stop.hasQuieter || stop.hasLivelier)) ??
    byMiddle.find((stop) => stop.hasQuieter && stop.hasLivelier);
  return pick?.index ?? Math.floor(stops.length / 2);
}

/**
 * The curve's level at a stop that makes it show the candidate at `target`, and only just:
 * past the midpoint between the target and the candidate before it on the way there, by the
 * switching margin and a little more. Pulled this far at its wire, the stop switches, and
 * no other stop moves.
 */
export function switchingLevel(energies: readonly number[], shown: number, target: number): number {
  const direction = Math.sign(target - shown);
  if (direction === 0) return target;
  const onTheWay = energies.filter((energy) =>
    direction > 0 ? energy >= shown && energy < target : energy <= shown && energy > target,
  );
  const before = direction > 0 ? Math.max(shown, ...onTheWay) : Math.min(shown, ...onTheWay);
  return (before + target) / 2 + direction * (SWITCH_MARGIN / 2 + PAST_SWITCH_LEVELS);
}

/**
 * Where a pull at one moment of the day falls: the stop before it, the stop after it, and
 * how far along between them, from 0 at the first to 1 at the second. Before the first
 * stop or after the last, both are that stop.
 */
function grabOf(
  mids: readonly number[],
  centerMinutes: number,
): { from: number; to: number; t: number } {
  const next = mids.findIndex((mid) => mid >= centerMinutes);
  if (next === -1) return { from: mids.length - 1, to: mids.length - 1, t: 1 };
  if (next === 0) return { from: 0, to: 0, t: 1 };
  const before = mids[next - 1] ?? centerMinutes;
  const after = mids[next] ?? centerMinutes;
  const t = after > before ? (centerMinutes - before) / (after - before) : 1;
  return { from: next - 1, to: next, t };
}

/**
 * How much of a pull reaches the curve at the grab point. At a stop it is all of it;
 * between two stops each moves by its share, so the curve there moves less, and never
 * under half. Dividing the pull by this keeps the curve under the pointer wherever it is
 * grabbed.
 */
export function pullGain(mids: readonly number[], centerMinutes: number): number {
  const { from, to, t } = grabOf(mids, centerMinutes);
  if (from === to) return 1;
  return (1 - t) ** 2 + t ** 2;
}

/**
 * Pulls the curve by `delta` levels at one moment of the day. A pull moves only the stops
 * on either side of the hand, each by how near it is grabbed: at a stop's wire, that stop
 * alone. Its neighbours stay, so dragging one stop never swaps another
 * (`docs/decisions.md`, "The energy curve stays on the client and picks among the versions the
 * model wrote").
 */
export function bendCurve(
  base: readonly number[],
  mids: readonly number[],
  centerMinutes: number,
  delta: number,
): number[] {
  const { from, to, t } = grabOf(mids, centerMinutes);
  return base.map((energy, index) => {
    const share = (index === from ? 1 - t : 0) + (index === to ? t : 0);
    return clampEnergy(energy + delta * share);
  });
}

/**
 * Slopes at each stop that keep the curve monotone between stops (Steffen's method): it
 * never swings past a stop's neighbours, so two lively stops in a row stay lively between
 * them instead of bulging.
 */
export function monotoneSlopes(curve: readonly number[], mids: readonly number[]): number[] {
  const secants = mids.slice(0, -1).map((mid, index) => {
    const span = (mids[index + 1] ?? mid) - mid;
    return span > 0 ? ((curve[index + 1] ?? 0) - (curve[index] ?? 0)) / span : 0;
  });
  return curve.map((_, index) => {
    const before = secants[index - 1];
    const after = secants[index];
    if (before === undefined) return after ?? 0;
    if (after === undefined) return before;
    const spanBefore = (mids[index] ?? 0) - (mids[index - 1] ?? 0);
    const spanAfter = (mids[index + 1] ?? 0) - (mids[index] ?? 0);
    if (spanBefore + spanAfter <= 0) return 0;
    const blended = (before * spanAfter + after * spanBefore) / (spanBefore + spanAfter);
    const limit = Math.min(Math.abs(before), Math.abs(after), Math.abs(blended) / 2);
    return (Math.sign(before) + Math.sign(after)) * limit;
  });
}

/**
 * Energy at any minute of a smooth line through the stops with the given slopes at each
 * stop: a cubic Hermite stretch between each pair.
 */
export function hermiteAt(
  curve: readonly number[],
  mids: readonly number[],
  slopes: readonly number[],
  minutes: number,
): number {
  const last = mids.length - 1;
  if (last < 0) return 0;
  if (minutes <= (mids[0] ?? 0)) return curve[0] ?? 0;
  if (minutes >= (mids[last] ?? 0)) return curve[last] ?? 0;
  const segment = mids.findIndex(
    (mid, index) => minutes >= mid && minutes < (mids[index + 1] ?? mid),
  );
  // Stops out of order or at the same minute (possible mid-stream) get no smooth stretch.
  if (segment === -1) return curve[last] ?? 0;
  const from = mids[segment] ?? 0;
  const span = (mids[segment + 1] ?? from) - from;
  if (span <= 0) return curve[segment] ?? 0;
  const t = (minutes - from) / span;
  const t2 = t * t;
  const t3 = t2 * t;
  return clampEnergy(
    (2 * t3 - 3 * t2 + 1) * (curve[segment] ?? 0) +
      (t3 - 2 * t2 + t) * span * (slopes[segment] ?? 0) +
      (-2 * t3 + 3 * t2) * (curve[segment + 1] ?? 0) +
      (t3 - t2) * span * (slopes[segment + 1] ?? 0),
  );
}

/** Energy along the curve at any minute: a smooth line through the stops. */
export function curveAt(
  curve: readonly number[],
  mids: readonly number[],
  minutes: number,
): number {
  return hermiteAt(curve, mids, monotoneSlopes(curve, mids), minutes);
}

/** Points along the curve from the first stop to the last, for drawing it. */
export function sampleCurve(curve: readonly number[], mids: readonly number[]): CurveSample[] {
  return mids.flatMap((mid, index) => {
    const next = mids[index + 1];
    if (next === undefined) return [{ minutes: mid, energy: curve[index] ?? 0 }];
    return Array.from({ length: SAMPLES_PER_SEGMENT }, (_, step) => {
      const minutes = mid + ((next - mid) * step) / SAMPLES_PER_SEGMENT;
      return { minutes, energy: curveAt(curve, mids, minutes) };
    });
  });
}
