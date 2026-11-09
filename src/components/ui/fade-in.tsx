"use client";

import { motion, useReducedMotion } from "motion/react";
import { Fragment, useState, type ReactNode } from "react";
import { SPRINGS } from "@/lib/tokens/motion";

/** How far faded in a change comes in, so it reads as a change of words, not a blink. */
const COMES_FROM = 0.3;

interface FadeInProps {
  /** What the words are: each new value comes in from part-way faded, on the snappy spring. */
  of: string;
  children: ReactNode;
}

/**
 * Words the page already knows, changed: they come in whole, from most of the way faded, in
 * about 0.2 s, rather than written letter by letter, which is the pen's for the model's own
 * words. What it first shows stands at once, as it is, so a page drawn on the server is never
 * faint; with reduced motion every change stands at once. Kept mounted while its words come
 * and go, so words that arrive after it is drawn, from none, come in too.
 */
export function FadeIn({ of, children }: FadeInProps) {
  const isReducedMotion = useReducedMotion() ?? false;
  const [first] = useState(of);
  const [hasChanged, setHasChanged] = useState(false);
  const isChanged = hasChanged || of !== first;
  if (isChanged !== hasChanged) setHasChanged(isChanged);
  // Until its words first change they are drawn as they are, with nothing around them.
  if (!isChanged) return <>{children}</>;
  return (
    <motion.span
      key={of}
      initial={isReducedMotion ? false : { opacity: COMES_FROM }}
      animate={{ opacity: 1 }}
      transition={SPRINGS.snappy}
    >
      {children}
    </motion.span>
  );
}

/** A piece of a text whose changed words fade in, set in its own colour. */
export interface FadedPart {
  text: string;
  className?: string;
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/** Whether a cut at this place in the text falls inside a word. */
function isInsideWord(text: string, at: number): boolean {
  return WORD_CHARACTER.test(text[at - 1] ?? "") && WORD_CHARACTER.test(text[at] ?? "");
}

/**
 * How much of their start and of their end two texts share, by whole words: what lies between,
 * in the second, is what changed.
 */
export function sharedEndsOf(before: string, after: string): { start: number; end: number } {
  const limit = Math.min(before.length, after.length);
  let start = 0;
  while (start < limit && before[start] === after[start]) start += 1;
  while (start > 0 && (isInsideWord(before, start) || isInsideWord(after, start))) start -= 1;
  let end = 0;
  const atEnd = (text: string, back: number) => text[text.length - 1 - back];
  while (end < limit - start && atEnd(before, end) === atEnd(after, end)) end += 1;
  while (
    end > 0 &&
    (isInsideWord(before, before.length - end) || isInsideWord(after, after.length - end))
  ) {
    end -= 1;
  }
  return { start, end };
}

/**
 * A text the page already knows, changed in part: only the words that changed come in, as
 * `FadeIn` brings a whole text in, and the words it shares with the text before stand as they
 * were. What it first shows stands at once; words that arrive from none come in whole.
 */
export function FadeInChanged({ parts }: { parts: readonly FadedPart[] }) {
  const isReducedMotion = useReducedMotion() ?? false;
  const text = parts.map((part) => part.text).join("");
  const [last, setLast] = useState({ text, before: text });
  if (last.text !== text) setLast({ text, before: last.text });
  const before = last.text === text ? last.before : last.text;
  const { start, end } = sharedEndsOf(before, text);
  const fadeTo = text.length - end;
  const froms = parts.map((_, index) =>
    parts.slice(0, index).reduce((sum, part) => sum + part.text.length, 0),
  );
  return (
    <>
      {parts.map((part, index) => {
        const from = froms[index] ?? 0;
        const cutFrom = Math.min(Math.max(start - from, 0), part.text.length);
        const cutTo = Math.min(Math.max(fadeTo - from, cutFrom), part.text.length);
        const faded = part.text.slice(cutFrom, cutTo);
        const pieces = (
          <>
            {part.text.slice(0, cutFrom)}
            {faded && (
              <motion.span
                key={text}
                initial={isReducedMotion ? false : { opacity: COMES_FROM }}
                animate={{ opacity: 1 }}
                transition={SPRINGS.snappy}
              >
                {faded}
              </motion.span>
            )}
            {part.text.slice(cutTo)}
          </>
        );
        return part.className ? (
          <span key={index} className={part.className}>
            {pieces}
          </span>
        ) : (
          <Fragment key={index}>{pieces}</Fragment>
        );
      })}
    </>
  );
}
