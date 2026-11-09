"use client";

import type { Itinerary } from "@/lib/schema/itinerary.schema";
import { formatClock } from "@/lib/time/clock";
import { Ink } from "@/components/ui/ink";
import { cn } from "@/components/ui/cn";
import { SunMark } from "@/features/abacus/best-light-icon";
import { DEK_PARTS, pieceOf } from "./dek";
import type { Answer, FactKey } from "./facts";
import { GlidingHeight } from "@/components/ui/gliding-height";
import type { BestLight } from "@/features/abacus/light";
import { RequestSentence, SentenceShape } from "./request-sentence";
import type { HeaderReserve } from "./reserve";
import { ASSUMED_CLASSES, type WordView } from "@/features/day/sentence-word";
import type { DekView, Slot } from "./use-request";
import { useWrittenText } from "@/components/ui/use-written-text";
import { LanternMark } from "@/components/ui/lantern-mark";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** The request as the headline and its input. */
export interface HeaderSentence {
  words: Readonly<Record<FactKey, WordView>>;
  /** The curve's clause, or null while the day shows the model's plan. */
  clause: string | null;
  isEnabled: boolean;
  isQuestionWritten: boolean;
  onChoose: (answer: Answer) => void;
  onLight: (key: FactKey | null) => void;
}

/**
 * The line about the day: streamed whole in the first write-in, then in its fragments, of
 * which an answer rewrites only its own while the others stay.
 */
export type HeaderDek =
  | { kind: "streamed"; text: string | undefined; isWriting: boolean }
  | { kind: "fragments"; view: DekView };

interface DayHeaderProps {
  itinerary: Itinerary;
  weather: string;
  sentence: HeaderSentence;
  dek: HeaderDek;
  slot: Slot;
  onRetry: (answer: Answer) => void;
  /** Nothing has arrived for a while: screen readers hear that the day is being written. */
  isWaiting: boolean;
  /** When the sun rises and sets, in minutes from midnight. */
  sunrise: number | null;
  sunset: number | null;
  reserve: HeaderReserve;
}

/**
 * The request, the line about the day and the facts. Unseen under the live lines, the
 * header's tallest state holds its height: the curve's clauses for the day on screen, so a
 * drag never moves anything below, and from an answer's click that answer's finished state.
 * When the reserve changes, the header's height springs to it, so the chart and the list
 * glide there once; the spare room sits under the facts.
 */
export function DayHeader({
  itinerary,
  weather,
  sentence,
  dek,
  slot,
  onRetry,
  isWaiting,
  sunrise,
  sunset,
  reserve,
}: DayHeaderProps) {
  const facts = { date: itinerary.date, weather, sunrise, sunset };
  const reservedDeks = reserve.deks.map((each) => (
    <span key={each} aria-hidden className="invisible col-start-1 row-start-1">
      {each}
    </span>
  ));
  return (
    <header className="flex shrink-0 flex-col pt-5 pb-5">
      <span className="type-voice text-heading italic">
        <LanternMark />
        Lantern
      </span>
      <GlidingHeight className="mt-5">
        <div className="grid">
          <div className="col-start-1 row-start-1 flex flex-col gap-3 self-start">
            <RequestSentence {...sentence} />
            <div className="flex flex-col gap-2">
              <p className="grid type-prose text-dek text-ink-soft">
                {/*
                 * Every line about the day holds its place unseen, so writing one never moves
                 * or rescales the chart below.
                 */}
                {reservedDeks}
                <span className="col-start-1 row-start-1">
                  {dek.kind === "streamed" ? (
                    <Ink text={dek.text} isActive={dek.isWriting} />
                  ) : (
                    <DekFragmentsLine view={dek.view} />
                  )}
                </span>
              </p>
              <p role="status" className="sr-only">
                {isWaiting ? "Writing the day" : slot?.kind === "error" ? "Couldn't re-plan" : ""}
              </p>
              <FactsLine {...facts} slot={slot} onRetry={onRetry} />
            </div>
          </div>
          <div aria-hidden className="invisible col-start-1 row-start-1 flex flex-col gap-3">
            <div className="grid">
              {reserve.sentences.flatMap((words, index) =>
                reserve.clauses.map((possible) => (
                  <SentenceShape
                    key={`${index}:${possible}`}
                    words={words}
                    clause={possible}
                    className="col-start-1 row-start-1"
                  />
                )),
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="grid type-prose text-dek">{reservedDeks}</p>
              <div className="grid">
                {reserve.slots.map((each, index) => (
                  <FactsLine
                    key={index}
                    {...facts}
                    slot={each}
                    className="col-start-1 row-start-1"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </GlidingHeight>
    </header>
  );
}

/**
 * The line about the day by fragment. The fragment an answer rewrites is erased by the pen
 * and written again as the stream writes it, in the same drying ink as the words; the
 * others never leave, so the line is never blank.
 */
function DekFragmentsLine({ view }: { view: DekView }) {
  return DEK_PARTS.map((part) => {
    const isRewritten = part === view.part;
    return (
      <DekFragment
        key={part}
        text={pieceOf(part, view.fragments[part], !isRewritten || view.isComplete)}
        isStreaming={isRewritten && view.isWriting}
      />
    );
  });
}

function DekFragment({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const written = useWrittenText(text);
  return <Ink text={written.text} isActive={written.isWriting || isStreaming} />;
}

interface FactsLineProps {
  date: string;
  weather: string;
  sunrise: number | null;
  sunset: number | null;
  slot: Slot;
  /** Without it, an error's word is plain text: the unseen copies hold no controls. */
  onRetry?: (answer: Answer) => void;
  className?: string;
}

/**
 * The facts from code, not the model: the date, the sun, the weather and the mark's key.
 * Its end says how to change a word until the first change, then why Lantern revised one,
 * or that a change failed.
 */
function FactsLine({ date, weather, sunrise, sunset, slot, onRetry, className }: FactsLineProps) {
  return (
    <p className={cn("type-note text-muted", className)}>
      {DATE_FORMAT.format(new Date(`${date}T12:00:00Z`))}
      {/* The same marks as on the chart's axis, so this line reads as their key. */}
      {sunrise !== null && (
        <>
          {" · "}
          <SunFact light="sunrise" minutes={sunrise} />
        </>
      )}
      {sunset !== null && (
        <>
          {" · "}
          <SunFact light="sunset" minutes={sunset} />
        </>
      )}
      {` · ${weather} · `}
      <span className={ASSUMED_CLASSES}>assumed</span> by Lantern
      <SlotText slot={slot} onRetry={onRetry} />
    </p>
  );
}

const RETRY_CLASSES =
  "rounded-sm underline decoration-1 underline-offset-4 transition-colors hover:text-energy focus-ring";

function SlotText({ slot, onRetry }: { slot: Slot; onRetry?: (answer: Answer) => void }) {
  if (!slot) return null;
  if (slot.kind === "hint") {
    return (
      <>
        {" · "}
        <span className="text-ink pointer-coarse:hidden">click a word to change it</span>
        <span className="hidden text-ink pointer-coarse:inline">tap a word to change it</span>
      </>
    );
  }
  if (slot.kind === "reason") {
    return (
      <>
        {" · "}
        <span>
          <Ink text={slot.text} isActive={slot.isWriting} />
        </span>
      </>
    );
  }
  return (
    <>
      {" · "}
      <span className="text-ink">
        Couldn&apos;t re-plan. Try{" "}
        {onRetry ? (
          <button type="button" onClick={() => onRetry(slot.answer)} className={RETRY_CLASSES}>
            {slot.name}
          </button>
        ) : (
          slot.name
        )}{" "}
        again
      </span>
    </>
  );
}

interface SunFactProps {
  light: BestLight;
  minutes: number;
}

/** "sunrise 07:43" after its mark, kept on one line. */
function SunFact({ light, minutes }: SunFactProps) {
  return (
    <span className="whitespace-nowrap text-amber">
      {/* Lifted a pixel, so its horizon sits on the baseline of the capitals. */}
      <SunMark light={light} className="mr-1 inline-block -translate-y-px text-lamp" />
      {light} {formatClock(minutes)}
    </span>
  );
}
