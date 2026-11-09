"use client";

import { animate, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SPRINGS } from "@/lib/tokens/motion";

export interface WrittenText {
  /** What is on screen: a start of the text being written or unwritten. */
  text: string;
  /** True until the text on screen is the whole target, while it writes in or out. */
  isWriting: boolean;
}

interface Shown {
  /** The text being written or unwritten. */
  text: string;
  /** How many of its characters are on screen. */
  count: number;
}

function sharedStartLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let length = 0;
  while (length < limit && a[length] === b[length]) length += 1;
  return length;
}

const WORD_BREAK = /\s/u;

/**
 * The start two texts share up to the last space they share, so the next text is written
 * from its first different word; the whole of either, when one starts the other.
 */
function sharedWordsLength(a: string, b: string): number {
  const shared = sharedStartLength(a, b);
  if (shared === a.length || shared === b.length) return shared;
  let length = shared;
  while (length > 0 && !WORD_BREAK.test(a[length - 1] ?? "")) length -= 1;
  return length;
}

/**
 * How a new target takes over: by default it keeps what it shares with the text on screen.
 * "words" keeps only the whole words it shares, for a line written again from its first
 * different word. "replace" drops the old text at once and writes the new from nothing, for
 * a word that takes the place of one struck out beside it. "whole" shows any new text at
 * once and only unwrites, for struck words, which appear in place and fold away. "instant"
 * shows the new text at once and lets the old go at once, for a revision that ends in place.
 * "fade" shows the new text whole at once, for words the page already knows, which no pen
 * writes (`FadeIn` brings them in); "fade-held" does the same for words that open a row of
 * their own, once that row has opened, the old text standing until then, and at once with
 * reduced motion, where no row glides.
 */
export type WritingMode = "keep" | "words" | "replace" | "whole" | "instant" | "fade" | "fade-held";

/**
 * Text that writes itself in and out like streamed text, for words code changes rather
 * than the stream. A new target unwrites what it does not share with the text on screen,
 * then writes the rest, each on the `gentle` spring. With reduced motion the target shows
 * at once.
 *
 * Held, for words that wait for their room, the pen writes nothing new: what is on screen
 * stays, a text being unwritten goes on unwriting, and the rest writes on once released.
 * Still, for words a hand is on, the pen stops where it is, writing and unwriting alike,
 * and goes on from there once let go.
 */
export function useWrittenText(
  target: string,
  mode: WritingMode = "keep",
  isHeld: boolean = false,
  isStill: boolean = false,
): WrittenText {
  const isReducedMotion = useReducedMotion() ?? false;
  const [shown, setShown] = useState<Shown>({ text: target, count: target.length });
  const shownRef = useRef(shown);
  // A hold matters only while there is something to write on, so it never interrupts the
  // spring of a text being unwritten.
  const isWaiting = isHeld && !shown.text.slice(0, shown.count).startsWith(target);
  // Still takes hold in the commit that says so. The effect below stops the spring only
  // after the browser has drawn a frame, and the pen would write a few more letters in it:
  // under a day that fades from where its stream ended, they would land in the fade.
  const isStillNow = useRef(isStill);
  useLayoutEffect(() => {
    isStillNow.current = isStill;
  }, [isStill]);
  // Whether a hold stands as the frame is drawn: a row its words open says it glides only once
  // it has measured them, in the commit after they were set.
  const isHeldNow = useRef(isHeld);
  useLayoutEffect(() => {
    isHeldNow.current = isHeld;
  }, [isHeld]);

  // At once, the text on screen is the target, and the next change writes on from it.
  const isEveryChangeAtOnce =
    mode === "instant" || mode === "fade" || (mode === "fade-held" && isReducedMotion);
  const isAtOnce = isEveryChangeAtOnce && (shown.text !== target || shown.count !== target.length);
  if (isAtOnce) setShown({ text: target, count: target.length });

  useEffect(() => {
    if (isEveryChangeAtOnce) {
      shownRef.current = { text: target, count: target.length };
      return undefined;
    }
    // Held for its row, the new text stands whole once nothing holds it: a frame after it is
    // set, so a row it opens has measured it and said it glides, and holds it until it has
    // opened. Text that goes, or ends shorter, goes at once: it opens nothing.
    if (mode === "fade-held") {
      const isWhole = shownRef.current.text === target && shownRef.current.count === target.length;
      if (isWhole || isWaiting || isStill) return undefined;
      const showWhole = () => {
        shownRef.current = { text: target, count: target.length };
        setShown(shownRef.current);
      };
      const onScreen = shownRef.current.text.slice(0, shownRef.current.count);
      if (onScreen.startsWith(target)) {
        showWhole();
        return undefined;
      }
      const frame = requestAnimationFrame(() => {
        if (!isHeldNow.current && !isStillNow.current) showWhole();
      });
      return () => cancelAnimationFrame(frame);
    }
    if (isReducedMotion || isStill) return undefined;
    const show = (text: string, count: number) => {
      if (isStillNow.current) return;
      const next = { text, count: Math.round(count) };
      if (next.text === shownRef.current.text && next.count === shownRef.current.count) return;
      shownRef.current = next;
      setShown(next);
    };
    const from = shownRef.current;
    const isReplacing = mode === "replace" && from.text !== target;
    const onScreen = from.text.slice(0, from.count);
    const kept = isReplacing
      ? 0
      : mode === "words"
        ? sharedWordsLength(onScreen, target)
        : sharedStartLength(onScreen, target);
    const write = () =>
      animate(kept, target.length, {
        ...SPRINGS.gentle,
        onUpdate: (count) => show(target, count),
      });
    let isWritingOn = false;
    let running: AnimationPlaybackControls | null = null;
    // Writing starts as soon as the last unshared character is gone, not on the spring's
    // slow tail, which would hold the word half-written for most of a second.
    const writeOn = () => {
      if (isWritingOn) return;
      isWritingOn = true;
      running?.stop();
      // Held, the pen stops where it is, and writes on from there when the effect runs again.
      running = isWaiting ? null : write();
    };
    if (from.count === kept || isReplacing) {
      writeOn();
    } else {
      running = animate(from.count, kept, {
        ...SPRINGS.gentle,
        onUpdate: (count) => {
          show(from.text, count);
          if (Math.round(count) <= kept) writeOn();
        },
        onComplete: writeOn,
      });
    }
    return () => running?.stop();
  }, [target, mode, isReducedMotion, isWaiting, isStill, isEveryChangeAtOnce]);

  if (mode === "fade" || (mode === "fade-held" && isReducedMotion)) {
    return { text: target, isWriting: false };
  }
  if (mode === "fade-held") {
    const text = shown.text.slice(0, shown.count);
    return { text, isWriting: text !== target };
  }
  if (isReducedMotion || mode === "instant") return { text: target, isWriting: false };
  if (mode === "whole" && target !== "") return { text: target, isWriting: false };
  // Until the new text starts writing, the old one is already gone.
  if (mode === "replace" && shown.text !== target) return { text: "", isWriting: true };
  const text = shown.text.slice(0, shown.count);
  return { text, isWriting: text !== target };
}
