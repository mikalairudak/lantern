"use client";

import { useRef } from "react";
import { cn } from "@/components/ui/cn";
import type { DayAnswer } from "@/lib/events/event.schema";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";

export const ANSWER_QUESTION = "Would you follow this day?";
export const ANSWER_WORDS: Readonly<Record<DayAnswer, string>> = {
  yes: "Yes",
  "not-quite": "Not quite",
};
export const ANSWER_THANKS = "Thank you.";

const CHOICE_CLASSES = cn(LINK_CLASSES, TARGET_CLASSES, "text-ink");

/**
 * The one-tap answer at a day's end (`docs/decisions.md`, "A day's end asks one question,
 * answered in one tap"): "Would you follow this day? Yes · Not quite", one quiet line, never a
 * modal and never free text. Asked once a day opened, with nothing kept in the browser; once
 * answered, a short thanks stands in its place, and stays through a re-plan of the same day. The question and the thanks hold
 * one room between them, so nothing below moves when the answer is given.
 */
export function DayAnswerLine({
  answered,
  onAnswer,
}: {
  /** The answer given for the day opened, held by the page, so a day's end drawn again thanks. */
  answered: DayAnswer | null;
  onAnswer: (answer: DayAnswer) => void;
}) {
  const thanks = useRef<HTMLParagraphElement>(null);
  const answer = (given: DayAnswer) => {
    onAnswer(given);
    // The pressed answer goes from sight with its question: the focus goes to the thanks.
    requestAnimationFrame(() => thanks.current?.focus());
  };
  return (
    // One cell of a grid, the question and the thanks over each other, so the line keeps the
    // taller of the two whichever shows.
    <div className="inline-grid type-note text-muted">
      <p
        className={cn(
          "col-start-1 row-start-1 flex flex-wrap items-baseline gap-x-2",
          answered && "invisible",
        )}
        aria-hidden={answered !== null || undefined}
      >
        <span>{ANSWER_QUESTION}</span>
        <span className="whitespace-nowrap">
          <button type="button" onClick={() => answer("yes")} className={CHOICE_CLASSES}>
            {ANSWER_WORDS.yes}
          </button>
          <span aria-hidden className="mx-2">
            ·
          </span>
          <button type="button" onClick={() => answer("not-quite")} className={CHOICE_CLASSES}>
            {ANSWER_WORDS["not-quite"]}
          </button>
        </span>
      </p>
      {/* Always in the page, its words alone changing, so every screen reader says the thanks;
          ringed for the keyboard as the list's names are. */}
      <p
        ref={thanks}
        role="status"
        tabIndex={-1}
        className="col-start-1 row-start-1 self-start justify-self-start rounded-sm focus-ring"
      >
        {answered === null ? "" : ANSWER_THANKS}
      </p>
    </div>
  );
}
