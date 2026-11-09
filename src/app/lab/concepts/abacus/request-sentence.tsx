"use client";

import type { ReactNode } from "react";
import type { EnergyLevel } from "@/lib/schema/itinerary.schema";
import { cn } from "@/components/ui/cn";
import { FACT_KEYS, labelOf, optionOf, type Answer, type FactKey, type Facts } from "./facts";
import type { DaySpan } from "@/features/abacus/geometry";
import { SentenceWord, wordClassesOf, type WordView } from "@/features/day/sentence-word";
import { useWrittenText } from "@/components/ui/use-written-text";
import { ClauseText, setOff } from "@/features/day/clause-text";

export { ClauseText, setOff };

/**
 * The request as the headline, and the input. The visitor's own words are set in full ink;
 * only what the model assumed carries a mark, a dotted underline, so the one mark in the
 * sentence says "Lantern filled this in". The open question ends it, written in last. Every
 * changeable word opens in place. When the visitor changes the day, the curve adds an
 * energy clause after their energy word, which it never rewrites: "A calm Saturday,
 * livelier at lunch, in Alicante".
 */

type Part =
  | { kind: "text"; text: string }
  /** The visitor's word, fixed for now: changing the date or the city needs the live model. */
  | { kind: "chosen"; text: string }
  | { kind: "clause" }
  /**
   * A fact. `lead` is written in with it, such as the space before the question. `trail`
   * is the comma after it, kept on its line: a line may otherwise break between the word,
   * set unbroken, and its comma. A trail can wait for the question that follows it.
   */
  | { kind: "fact"; key: FactKey; lead?: string; trail?: string; isTrailForQuestion?: boolean };

const text = (value: string): Part => ({ kind: "text", text: value });

export const ALICANTE_SENTENCE: readonly Part[] = [
  text("A "),
  { kind: "fact", key: "energy" },
  text(" "),
  { kind: "chosen", text: "Saturday" },
  // Where the curve's clause goes, set off by commas.
  { kind: "clause" },
  text(" in "),
  { kind: "chosen", text: "Alicante" },
  text(", "),
  { kind: "fact", key: "travel", trail: "," },
  text(" "),
  { kind: "fact", key: "start", trail: "," },
  text(" "),
  { kind: "fact", key: "dinner", trail: "," },
  text(" "),
  { kind: "fact", key: "end", trail: ",", isTrailForQuestion: true },
  { kind: "fact", key: "company", lead: " " },
];

/**
 * Wrapped greedily, `text-pretty` rather than `text-balance`: balancing re-flows the whole
 * headline as a word writes in, moving words already written from line to line, while
 * greedy lines keep what is written where it is.
 */
const SENTENCE_CLASSES = "type-voice text-title text-pretty text-ink-soft";

/** What each word's picker is called, for screen readers. */
const LIST_LABELS: Readonly<Record<FactKey, string>> = {
  energy: "The day's energy",
  travel: "Getting around",
  start: "The morning",
  dinner: "Dinner",
  end: "The end of the night",
  company: "Who is coming",
};

const MINUTES_PER_HOUR = 60;

/**
 * The hours the request implies, "early start" to "home by eleven": the chart's frame
 * before the model writes anything, so it never rescales as the day arrives.
 */
export const ALICANTE_HOURS: DaySpan = { start: 7 * MINUTES_PER_HOUR, end: 23 * MINUTES_PER_HOUR };

/** Out late, the frame runs to midnight. */
const OUT_LATE_END = 24 * MINUTES_PER_HOUR;

/** The hours the request asks for now: out late moves the frame's end to midnight. */
export function hoursOf(facts: Facts): DaySpan {
  return facts.end.value === "late" ? { ...ALICANTE_HOURS, end: OUT_LATE_END } : ALICANTE_HOURS;
}

/** The energy the visitor asked for, where a stop's bead lands before its own is known. */
export const ALICANTE_ENERGY: EnergyLevel = "calm";

/**
 * Each word as the sentence shows it, with its options. A consequence line comes from the
 * caller, which knows what each answer would change.
 */
export function wordViewsOf(
  facts: Facts,
  consequenceOf: (answer: Answer) => string | null,
): Record<FactKey, WordView> {
  const views = FACT_KEYS.map((key): [FactKey, WordView] => {
    const fact = facts[key];
    return [
      key,
      {
        key,
        label: labelOf(fact),
        source: fact.source,
        struck:
          fact.revisedFrom === null ? null : (optionOf(fact, fact.revisedFrom)?.label ?? null),
        listLabel: LIST_LABELS[key],
        options: fact.options.map((option) => {
          const isCurrent = option.value === fact.value;
          return {
            value: option.value,
            label: option.label,
            isCurrent,
            consequence: isCurrent ? null : consequenceOf({ key, value: option.value }),
          };
        }),
      },
    ];
  });
  return Object.fromEntries(views) as Record<FactKey, WordView>;
}

type FactPart = Extract<Part, { kind: "fact" }>;

/** The fixed parts of the sentence, with each fact and the clause drawn by the caller. */
function partsWith(renderFact: (part: FactPart) => ReactNode, clause: ReactNode): ReactNode[] {
  return ALICANTE_SENTENCE.map((part, index) => {
    if (part.kind === "text") return part.text;
    if (part.kind === "clause") return <span key={index}>{clause}</span>;
    if (part.kind === "chosen") {
      return (
        <span key={index} className="text-ink">
          {part.text}
        </span>
      );
    }
    return <span key={index}>{renderFact(part)}</span>;
  });
}

interface RequestSentenceProps {
  words: Readonly<Record<FactKey, WordView>>;
  /** The curve's clause, or null while the day shows the model's plan. */
  clause: string | null;
  /** The day is written and still: its words can be opened. */
  isEnabled: boolean;
  /** The day is written, so the open question may write in, last. */
  isQuestionWritten: boolean;
  onChoose: (answer: Answer) => void;
  /** A word is under the pointer or the focus, or none is. */
  onLight: (key: FactKey | null) => void;
}

export function RequestSentence({
  words,
  clause,
  isEnabled,
  isQuestionWritten,
  onChoose,
  onLight,
}: RequestSentenceProps) {
  const written = useWrittenText(setOff(clause));
  // Only an unanswered question waits for the day: an answer is already there.
  const isQuestionHeld = !isQuestionWritten && words.company.source === "asked";
  return (
    <h1 className={SENTENCE_CLASSES}>
      {partsWith(
        ({ key, lead, trail, isTrailForQuestion }) => (
          <SentenceWord
            view={words[key]}
            lead={lead}
            trail={isTrailForQuestion && isQuestionHeld ? "" : trail}
            isHeld={isQuestionHeld && key === "company"}
            isEnabled={isEnabled}
            onChoose={(value) => onChoose({ key, value })}
            onLight={(isLit) => onLight(isLit ? key : null)}
          />
        ),
        <ClauseText text={written.text} isWriting={written.isWriting} />,
      )}
    </h1>
  );
}

interface SentenceShapeProps {
  words: Readonly<Record<FactKey, WordView>>;
  /** A clause written in full, or null for the sentence without one. */
  clause: string | null;
  className: string;
}

/**
 * The sentence with given words and a clause written in full, unseen and inert: stacked in
 * one place, these hold the height of the headline's tallest state. Each word is set as
 * the live one is, unbreakable, so both wrap alike.
 */
export function SentenceShape({ words, clause, className }: SentenceShapeProps) {
  return (
    <p aria-hidden className={cn(SENTENCE_CLASSES, "invisible", className)}>
      {partsWith(
        ({ key, lead, trail }) => {
          const view = words[key];
          return (
            <>
              {lead}
              {view.struck && <del>{`${view.struck} `}</del>}
              <span className="inline-block whitespace-nowrap">
                <span className={wordClassesOf(view)}>{view.label}</span>
                {trail}
              </span>
            </>
          );
        },
        <ClauseText text={setOff(clause)} isWriting={false} />,
      )}
    </p>
  );
}
