import { describe, expect, it } from "vitest";
import {
  CATCH_UP_SECONDS,
  SILENCE_SECONDS,
  START,
  STOP_BEAT_SECONDS,
  isSilent,
  stepPlayback,
  type Playback,
} from "./playback";

/** Six stops starting every 100 characters, then the options. */
const BOUNDARIES = [100, 200, 300, 400, 500, 600, 700];
const TOTAL = 800;
const FRAME = 1 / 60;

/** Plays a stream frame by frame: `writtenAt` says what the stream has written when. */
function play(writtenAt: (seconds: number) => number, until: number) {
  const frames: { seconds: number; playback: Playback }[] = [];
  let playback = START;
  for (let seconds = 0; seconds <= until; seconds += FRAME) {
    playback = stepPlayback(playback, writtenAt(seconds), seconds, BOUNDARIES);
    frames.push({ seconds, playback });
  }
  return frames;
}

/** When each boundary was crossed on screen. */
function releases(frames: ReturnType<typeof play>): number[] {
  return BOUNDARIES.map(
    (boundary) => frames.find(({ playback }) => playback.shown > boundary)?.seconds ?? Infinity,
  );
}

describe("stepPlayback", () => {
  it("shows text inside a stop as soon as it is written", () => {
    const playback = stepPlayback({ ...START, shown: 120, releasedAt: 0 }, 180, 0.05, BOUNDARIES);

    expect(playback.shown).toBe(180);
  });

  it("lets stops in at a steady beat when they arrive in a lump", () => {
    // Three stops arrive at once: under a second's worth, so no catching up.
    const frames = play((seconds) => (seconds < 1 ? 90 : 390), 3);
    const [first, second, third] = releases(frames);

    expect(second! - first!).toBeGreaterThanOrEqual(STOP_BEAT_SECONDS - 1e-9);
    expect(third! - second!).toBeGreaterThanOrEqual(STOP_BEAT_SECONDS - 1e-9);
    expect(third! - second!).toBeLessThan(STOP_BEAT_SECONDS + 2 * FRAME);
  });

  it("holds a stop at its start until its beat, while the stop before plays out", () => {
    const frames = play((seconds) => (seconds < 1 ? 90 : 290), 1.2);
    const atOne = frames.find(({ seconds }) => seconds >= 1 + FRAME)!.playback;

    expect(atOne.shown).toBe(200);
  });

  it("plays faster when the queue would take more than a second", () => {
    const frames = play((seconds) => (seconds < 1 ? 90 : TOTAL), 4);
    const times = releases(frames);
    const firstBeats = times.slice(1, 4).map((time, index) => time - times[index]!);

    expect(firstBeats[0]!).toBeLessThan(STOP_BEAT_SECONDS);
    expect(times.at(-1)! - times[0]!).toBeLessThan(CATCH_UP_SECONDS + STOP_BEAT_SECONDS * 3);
    expect(frames.at(-1)!.playback.shown).toBe(TOTAL);
  });
});

describe("isSilent", () => {
  it("never shows waiting while data flows", () => {
    const frames = play((seconds) => Math.min(TOTAL, Math.floor(seconds * 150)), 6);

    expect(frames.some(({ seconds, playback }) => isSilent(playback, seconds, TOTAL))).toBe(false);
  });

  it("shows waiting after 0.4 seconds of silence and clears on the next arrival", () => {
    // Writing until 1 s, silent until 2 s, writing again.
    const frames = play(
      (seconds) => (seconds < 1 ? Math.floor(seconds * 80) : seconds < 2 ? 80 : 95),
      2.5,
    );
    const silentAt = (time: number) => {
      const frame = frames.find(({ seconds }) => seconds >= time)!;
      return isSilent(frame.playback, frame.seconds, TOTAL);
    };

    expect(silentAt(1 + SILENCE_SECONDS - 0.05)).toBe(false);
    expect(silentAt(1 + SILENCE_SECONDS + 0.05)).toBe(true);
    expect(silentAt(1.9)).toBe(true);
    expect(silentAt(2 + FRAME)).toBe(false);
  });

  it("shows waiting before the first words, and never once the day is complete", () => {
    expect(isSilent(START, SILENCE_SECONDS, TOTAL)).toBe(true);
    expect(isSilent({ ...START, shown: TOTAL }, 10, TOTAL)).toBe(false);
  });
});
