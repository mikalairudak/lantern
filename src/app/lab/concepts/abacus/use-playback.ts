"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { budgetAt, type Keyframe } from "./pacing";
import { START, isSilent, stepPlayback } from "./playback";

const MS_PER_SECOND = 1000;
const NO_BOUNDARIES: readonly number[] = [];

export interface PlaybackOptions {
  /** Starts with the whole day shown: tests, and a replay with reduced motion. */
  startsComplete?: boolean;
  /**
   * A simulated live model rather than a replay: its arrivals are smoothed at these
   * boundaries, and reduced motion still lets the day arrive piece by piece.
   */
  live?: { boundaries: readonly number[] };
}

export interface PlaybackView {
  /** How much of the day is on screen, as a budget for `revealDay`. */
  written: number;
  /** The day is unfinished and nothing new has arrived for a while. */
  isWaiting: boolean;
}

/**
 * The day arriving over time, following its keyframes from nothing to the whole day. It
 * starts at nothing unless asked to start complete, so the server render and the first
 * client render match; remount it to play again. With reduced motion a replay shows the
 * finished day at once, since it is a replay of a day already written; a live stream
 * still arrives as it is written, each piece in its final state.
 */
export function usePlayback(
  keyframes: readonly Keyframe[],
  { startsComplete = false, live }: PlaybackOptions = {},
): PlaybackView {
  const isReducedMotion = useReducedMotion();
  const total = keyframes.at(-1)?.budget ?? 0;
  const boundaries = live?.boundaries ?? NO_BOUNDARIES;
  const isShownAtOnce = Boolean(isReducedMotion) && !live;
  const initial: PlaybackView = { written: startsComplete ? total : 0, isWaiting: false };
  // Kept with the keyframes it belongs to, so new keyframes start from nothing rather than
  // from where the last ones ended, even for the one render before the first frame.
  const [view, setView] = useState<PlayedView>({ keyframes, ...initial });

  useEffect(() => {
    if (startsComplete) return;
    const startedAt = performance.now();
    let playback = START;
    let frame = 0;
    const tick = (now: number) => {
      const seconds = Math.max(0, now - startedAt) / MS_PER_SECOND;
      const written = isShownAtOnce ? total : budgetAt(keyframes, seconds);
      playback = stepPlayback(playback, written, seconds, boundaries);
      const isWaiting = isSilent(playback, seconds, total);
      setView((current) =>
        current.keyframes === keyframes &&
        current.written === playback.shown &&
        current.isWaiting === isWaiting
          ? current
          : { keyframes, written: playback.shown, isWaiting },
      );
      if (playback.shown < total) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [keyframes, total, startsComplete, isShownAtOnce, boundaries]);

  if (view.keyframes !== keyframes) return initial;
  return { written: view.written, isWaiting: view.isWaiting };
}

interface PlayedView extends PlaybackView {
  keyframes: readonly Keyframe[];
}
