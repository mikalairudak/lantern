import {
  candidatesOf,
  energyOf,
  hintStop,
  midOf,
  modelPick,
  stepEnergy,
  switchingLevel,
} from "./curve";
import { hasEnergy, type StopDraft } from "./day-draft";

/**
 * A pull of the curve the chart draws as an example, never makes: where it would be grabbed
 * and how far it would move, as a drag would make it.
 */
export interface ExamplePull {
  /** The stop pulled, as an index into the day's stops. */
  stopIndex: number;
  /** Where the curve would be grabbed: the middle of the stop's time. */
  minutes: number;
  /** How far the grab point would move, in energy levels: livelier is positive. */
  levels: number;
}

/** Whether a stop, by its index in the day, can be seen where the day is on the page. */
export type IsSeen = (index: number) => boolean;

/**
 * The stop that invites the first drag, where the ring waits and the example is drawn, as
 * an index into the day's stops; null before any stop sits on the curve. Given which stops
 * can be seen, it keeps to them where it can (`hintStop`).
 */
export function invitedStop(stops: readonly StopDraft[], isSeen?: IsSeen): number | null {
  const onCurve = stops.filter(hasEnergy);
  const seen = isSeen && ((index: number) => isSeen(stops.indexOf(onCurve[index]!)));
  const stop = onCurve[hintStop(onCurve, seen)];
  return stop ? stops.indexOf(stop) : null;
}

/**
 * The example's pull at a stop, by its index: the stop moved one version livelier, or
 * quieter when it has nothing livelier, just past the point where it switches, so the
 * example says one thing. Null when there is no such stop or it has no other version.
 */
export function examplePullAt(
  stops: readonly StopDraft[],
  stopIndex: number | null,
): ExamplePull | null {
  const stop = stopIndex === null ? undefined : stops[stopIndex];
  if (stopIndex === null || !stop || !hasEnergy(stop)) return null;
  const shown = modelPick(stop);
  const target = stepEnergy(stop, shown, "livelier") ?? stepEnergy(stop, shown, "quieter");
  if (target === null) return null;
  const shownEnergy = energyOf(candidatesOf(stop)[shown] ?? stop.primary);
  const energies = candidatesOf(stop).map(energyOf);
  return {
    stopIndex,
    minutes: midOf(stops, stop),
    levels: switchingLevel(energies, shownEnergy, target) - shownEnergy,
  };
}
