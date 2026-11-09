import { SILENCE_SECONDS } from "@/features/day/use-silence";
import { STOP_BEAT_SECONDS } from "@/features/day/use-pen";
import type { StreamOffsets } from "./pacing";

/**
 * What reaches the screen from the stream, and when. A model writes unevenly: data may
 * arrive in a lump, then nothing for a while. Stops are let in at a steady beat, never
 * faster than one per `STOP_BEAT_SECONDS`, and the beat quickens when the queue would take
 * longer than `CATCH_UP_SECONDS` to play. Text inside a stop flows as it comes. A silence
 * of `SILENCE_SECONDS` while the day is unfinished is when the waiting line may show.
 */

export { SILENCE_SECONDS, STOP_BEAT_SECONDS };
export const CATCH_UP_SECONDS = 1;

export interface Playback {
  /** How much of the day is on screen, as a budget. */
  shown: number;
  /** When the screen last let in a stop or the options, in seconds. */
  releasedAt: number | null;
  /** When anything new last reached the screen, in seconds. */
  changedAt: number;
}

export const START: Playback = { shown: 0, releasedAt: null, changedAt: 0 };

/** Where new arrivals begin in the stream: each stop, then the options. */
export function arrivalBoundaries(offsets: StreamOffsets): number[] {
  return [...offsets.stops, offsets.options];
}

/**
 * One frame of playback: how much of what the stream has written is shown now. A stop
 * waits at its start until a beat has passed since the last one came in; everything else
 * shows as soon as it is written.
 */
export function stepPlayback(
  playback: Playback,
  written: number,
  seconds: number,
  boundaries: readonly number[],
): Playback {
  const waiting = boundaries.filter((boundary) => boundary >= playback.shown && boundary < written);
  const next = waiting[0];
  const beat =
    waiting.length * STOP_BEAT_SECONDS > CATCH_UP_SECONDS
      ? CATCH_UP_SECONDS / waiting.length
      : STOP_BEAT_SECONDS;
  const isDue = playback.releasedAt === null || seconds - playback.releasedAt >= beat;

  const shown =
    next === undefined
      ? Math.max(playback.shown, written)
      : isDue
        ? Math.min(written, boundaries.find((boundary) => boundary > next) ?? written)
        : next;
  const releasedAt = next !== undefined && isDue ? seconds : playback.releasedAt;
  return {
    shown,
    releasedAt,
    changedAt: shown === playback.shown ? playback.changedAt : seconds,
  };
}

/** Whether the day is unfinished and nothing new has reached the screen for a while. */
export function isSilent(playback: Playback, seconds: number, total: number): boolean {
  return playback.shown < total && seconds - playback.changedAt >= SILENCE_SECONDS;
}
