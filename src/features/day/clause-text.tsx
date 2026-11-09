"use client";

import { useEffect, useState } from "react";
import { FadeInChanged, type FadedPart } from "@/components/ui/fade-in";
import { Ink } from "@/components/ui/ink";

const CLAUSE_OPENING = ", ";
const CLAUSE_CLOSING = ",";

/**
 * How long a clause the curve let go stands whole in the line it opened before it goes:
 * about 0.2 s to come in, then long enough to read three words.
 */
export const OWED_CLAUSE_STANDS_MS = 600;

/**
 * Whether the owed clause has stood whole long enough to be paid (`owedClauseOf`'s
 * `isOwedWhole`): whole in the frame after its line opens, it would otherwise go in the next.
 * Its time starts over whenever it stops standing whole, as when its line glides again, so it
 * is never paid at once on its return; and over for each new clause.
 */
export function useHasStood(clause: string | null, isStanding: boolean): boolean {
  const [stood, setStood] = useState<string | null>(null);
  if (!isStanding && stood !== null) setStood(null);
  useEffect(() => {
    if (!isStanding) return undefined;
    const timer = setTimeout(() => setStood(clause), OWED_CLAUSE_STANDS_MS);
    return () => clearTimeout(timer);
  }, [isStanding, clause]);
  return isStanding && stood === clause;
}

/** The clause as it sits in the sentence, commas included, so they come in with it. */
export function setOff(clause: string | null): string {
  return clause === null ? "" : `${CLAUSE_OPENING}${clause}${CLAUSE_CLOSING}`;
}

/** What the sentence knows as it draws the curve's clause, for `owedClauseOf`. */
export interface ClauseMoment {
  /** The sentence's row is gliding, as it does when a clause opens a line for itself. */
  isOpening: boolean;
  /** A word of the sentence has its panel open: a hand is on the sentence. */
  isPanelOpen: boolean;
  /** The clause owed so far stands written whole, to its closing comma. */
  isOwedWhole: boolean;
}

/**
 * The clause the sentence owes its row: a line that opens for a clause receives it, so once
 * the row glides open for a clause, the clause is written whole though the curve lets it go
 * meanwhile, as a drag taken straight back does, and only then unwrites. A clause
 * that needs no new line is owed nothing and goes as the curve lets it go. While a hand is
 * on the sentence, a word's panel open, the debt stands as it is: the sentence keeps still
 * under the panel, and pays once it closes.
 */
export function owedClauseOf(
  owed: string | null,
  clause: string | null,
  { isOpening, isPanelOpen, isOwedWhole }: ClauseMoment,
): string | null {
  if (isPanelOpen) return owed;
  if (clause !== null) return isOpening || owed === clause ? clause : null;
  return isOwedWhole ? null : owed;
}

interface ClauseTextProps {
  /** The set-off clause, ", livelier at lunch,", or a start of it. */
  text: string;
  /** A pen writes it, as the lab's concepts do: its newest letters in the stream's drying ink. */
  isWriting?: boolean;
  /**
   * Its changed words come in faded, the words it keeps standing (`FadeInChanged`), as the
   * sentence's clause does; an unseen copy that holds its room stands at once.
   */
  isFaded?: boolean;
}

/** The clause's words in the energy colour; its commas in the sentence's ink. */
export function ClauseText({ text, isWriting = false, isFaded = false }: ClauseTextProps) {
  // The clause's own words have no comma, so a closing one means it is whole.
  const isClosed = text.length > CLAUSE_OPENING.length && text.endsWith(CLAUSE_CLOSING);
  const words = text.slice(CLAUSE_OPENING.length, isClosed ? -CLAUSE_CLOSING.length : undefined);
  // The opening comma comes and goes with the clause's words, so the word before it never
  // stands with a comma and nothing after it.
  const parts: FadedPart[] = [
    { text: words ? CLAUSE_OPENING : "" },
    { text: words, className: "text-energy" },
    { text: isClosed ? CLAUSE_CLOSING : "" },
  ];
  if (isFaded) return <FadeInChanged parts={parts} />;
  return (
    <>
      {parts[0]?.text}
      <span className="text-energy">
        <Ink text={words} isActive={isWriting} />
      </span>
      {parts[2]?.text}
    </>
  );
}
