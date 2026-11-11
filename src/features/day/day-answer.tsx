"use client";

import { useState } from "react";
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
 * modal and never free text. Asked once each time a day is shown, with nothing kept in the
 * browser; once answered, a short thanks stands in its place. The question and the thanks hold
 * one room between them, so nothing below moves when the answer is given.
 */
export function DayAnswerLine({
  onAnswer,
  answeredAtFirst = null,
}: {
  onAnswer: (answer: DayAnswer) => void;
  /** Drawn answered from the first frame, as a lab cell draws it. */
  answeredAtFirst?: DayAnswer | null;
}) {
  const [answered, setAnswered] = useState<DayAnswer | null>(answeredAtFirst);
  const answer = (given: DayAnswer) => {
    setAnswered(given);
    onAnswer(given);
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
      <p role="status" className={cn("col-start-1 row-start-1", answered === null && "invisible")}>
        {answered === null ? "" : ANSWER_THANKS}
      </p>
    </div>
  );
}
