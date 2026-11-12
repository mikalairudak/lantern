"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ASSUMABLE_FACT_KEYS, type DayRequest } from "@/lib/schema/itinerary.schema";
import { cn } from "@/components/ui/cn";
import { SITE_DESCRIPTION } from "@/lib/site";
import { useHydrated } from "@/components/ui/use-hydrated";
import { FACT_OPTIONS, optionOf } from "./facts";
import { ASSUMED_CLASSES } from "./sentence-word";
import { energyLabelOf, weekdayOf } from "./sentence";
import {
  MAX_INTAKE_TEXT_CHARS,
  type CityReading,
  type IntakeWords,
} from "@/lib/schema/intake.schema";
import { unplacedLineOf } from "./start";
import { LINK_CLASSES } from "./link-classes";
import { AskedSentence } from "./asked-sentence";
import { Masthead } from "./masthead";
import type { StartExcerpt } from "./start-excerpt";
import { StartExcerptView, StartIndex } from "./start-index";
import { YourDaysList, type YourDaysListProps } from "./your-days-list";
import type { StartOffer } from "./start-offers";

/** What Lantern is, in one line: the first thing the start screen says, as its previews do. */
export const PROMISE = SITE_DESCRIPTION;
/**
 * With live generation off, under the question: only that no new day is written. The days that are
 * written are the index below, named once. Once live it says nothing: the field and its button say
 * what happens.
 */
export const NOT_LIVE_NOTE = "Lantern isn't writing new days right now.";
/** After a line that can write no day: the way on, the index of days below the question. */
const TO_THE_INDEX = "Start from one of the days below.";
/** Under the field: a text that plays a written day just as it says, with nothing said back. */
const EXAMPLE = "For example: Bologna, with friends";
/** Under the field from the visitor's Enter, while Lantern reads their words. */
const READING_SAID = "Reading what you wrote";

/** Read in part, without a city: the sentence so far asks for one. */
export interface CityQuestion {
  kind: "question";
  words: IntakeWords;
  /** The cities a shared name could be, offered as answers; empty when none was named. */
  readings: readonly CityReading[];
  unplaced: readonly string[];
}

/** What the line under the question says, after the visitor has asked. */
export type StartLine =
  /**
   * The text is being read: a beat of about a second before the day starts. An answer to
   * "in …?" is read under its question, which the field and the sentence keep asking.
   */
  | { kind: "reading"; answering?: CityQuestion }
  /**
   * Read: the day it asked for is on its way, and takes the page in a moment. The line says
   * the visitor's day back as Lantern read it: written with live generation on, opened when
   * Lantern has written the day already. A day from an answer keeps the city's field.
   */
  | { kind: "writing"; request: DayRequest; answering?: CityQuestion }
  | CityQuestion
  /** No day can be written for this text yet: the days that are written are offered. */
  | { kind: "not-yet" }
  /** Lantern would not plan what was asked. */
  | { kind: "refused" }
  /** Our own limit answered. */
  | { kind: "limited" }
  | null;

export interface StartHeaderProps {
  /** The written days, offered under the question as an index. */
  starts: readonly StartOffer[];
  line: StartLine;
  /** What the visitor has typed, held by the day so a day on its way keeps it. */
  text: string;
  onTextChange: (text: string) => void;
  /** Lantern writes new days: the note says what happens next. Off, it says it does not. */
  isLive: boolean;
  /** The city was just asked for, after the visitor's text: the field takes the focus. */
  isCityFocused: boolean;
  /** The question is answered: the text, or the city asked for. */
  onPlan: (text: string) => void;
  /** A day Lantern has written, chosen: it is written where the question was. */
  onChooseWritten: (request: DayRequest) => void;
  /** One of the cities a shared name could be, chosen as the answer to "in …?". */
  onChooseReading: (reading: CityReading) => void;
  /**
   * The visitor's own days, listed over the index once there is one. The browser alone keeps
   * them, so the index waits for the list to be read rather than be pushed down by it.
   */
  yourDays?: YourDaysListProps;
  /** Shown again by Back from a day: its headline takes the focus the day had. */
  isReturnedTo?: boolean;
  /** A written day's first stops, still, under the ways in. */
  excerpt?: StartExcerpt | null;
}

/**
 * The start screen: what Lantern is in one line, one question, and the index of the days Lantern
 * has written, with the first stops of one of them under it, still. No day plays until the
 * visitor asks for one; a day pressed in the index is written where the question was.
 */
export function StartHeader({
  starts,
  line,
  text,
  onTextChange,
  isLive,
  isCityFocused,
  onPlan,
  onChooseWritten,
  onChooseReading,
  yourDays,
  isReturnedTo = false,
  excerpt = null,
}: StartHeaderProps) {
  const promise = useRef<HTMLHeadingElement>(null);
  const startsList = useRef<HTMLUListElement>(null);
  // Mounted again by Back, so read once, as it mounts.
  const [isFocusedOnMount] = useState(isReturnedTo);
  useEffect(() => {
    if (isFocusedOnMount) promise.current?.focus({ preventScroll: true });
  }, [isFocusedOnMount]);
  const isHydrated = useHydrated();
  const areStartsDrawn = yourDays === undefined || isHydrated;
  // Forgotten, the list goes with the control pressed: the first start takes the focus.
  const forget = () => {
    yourDays?.onForget();
    requestAnimationFrame(() => startsList.current?.querySelector("button")?.focus());
  };
  // An answer to "in …?" read to no day draws the field for a text again in place of the
  // city's: the focus the city's field had goes to it, not to the page.
  const isAskingCity = questionOf(line) !== null;
  const [wasAskingCity, setWasAskingCity] = useState(isAskingCity);
  const [isFocusHandedOn, setIsFocusHandedOn] = useState(false);
  if (wasAskingCity !== isAskingCity) {
    setWasAskingCity(isAskingCity);
    setIsFocusHandedOn(!isAskingCity && isNoDay(line));
  }

  return (
    <header className="flex shrink-0 flex-col pt-5 pb-5">
      <Masthead isHome />
      <h1 ref={promise} tabIndex={-1} className="mt-5 type-voice text-title text-pretty text-ink">
        {PROMISE}
      </h1>
      <QuestionForm
        // Asked for a city, the field starts again empty, with the focus, for the answer; it
        // stays the city's while the answer is read and its day sets off.
        key={questionOf(line) ? "city" : "text"}
        line={line}
        text={text}
        onTextChange={onTextChange}
        isLive={isLive}
        isCityFocused={isCityFocused}
        isFocusedOnMount={isFocusHandedOn}
        onPlan={onPlan}
        onChooseReading={onChooseReading}
      />
      {/* A line saying no day can be written says it in place of the note, not twice. While
          Lantern opens a day the note keeps its room unseen, for the line's second line. */}
      {!isLive && !isNoDay(line) && (
        <p
          className={cn(
            "mt-2 type-note text-muted",
            (line?.kind === "reading" || line?.kind === "writing") &&
              !line.answering &&
              "invisible",
          )}
        >
          {NOT_LIVE_NOTE}
        </p>
      )}
      {yourDays && areStartsDrawn && <YourDaysList {...yourDays} onForget={forget} />}
      {areStartsDrawn && (
        <>
          <StartIndex starts={starts} onChoose={onChooseWritten} listRef={startsList} />
          {excerpt && <StartExcerptView excerpt={excerpt} />}
        </>
      )}
    </header>
  );
}

interface QuestionFormProps {
  line: StartLine;
  text: string;
  onTextChange: (text: string) => void;
  isLive: boolean;
  isCityFocused: boolean;
  /** Drawn again in place of the city's field, it takes the focus that field had. */
  isFocusedOnMount: boolean;
  onPlan: (text: string) => void;
  onChooseReading: (reading: CityReading) => void;
}

/**
 * The light through what Lantern is working on while the start screen waits (`docs/decisions.md`,
 * "The first screen asks one question, and no day is drawn until a press", quickened since a cold
 * start's four seconds read as a hang): one band fixed to the screen, as the waiting line's is, so
 * the field's words, the line under them and the button light as it passes each, about every
 * second. Light in words is amber, the colour light is said in (5:1 and more as words are; the
 * lamp's, which draws light, was 3.84:1 at the band's peak), passing through words that stay in
 * their own ink, so nothing reads as switched off; a word in a colour of its own, the energy's,
 * keeps it. The band stands upright: slanted, as the waiting line's is, it drew a hard edge across
 * the button on a phone, where the screen's height shifts it sideways out of its own box. With
 * reduced motion the words stand in their ink.
 */
const STEADY_PASS_CLASSES =
  "bg-linear-90 from-transparent to-transparent bg-fixed bg-size-pass bg-no-repeat motion-safe:animate-pass-steady motion-reduce:bg-none";
/** Words lit by the steady light, in the ink they stand in. */
const STEADY_WORDS_LIT_CLASSES = (ink: "ink" | "ink-soft") =>
  cn(
    ink === "ink" ? "bg-ink" : "bg-ink-soft",
    "via-amber bg-clip-text text-transparent",
    STEADY_PASS_CLASSES,
  );
/** The button while Lantern works: the same light passing over its ink, its words over it. */
const STEADY_BUTTON_LIT_CLASSES = cn("via-amber", STEADY_PASS_CLASSES);
/**
 * The line under the field, a size up from a note: for the seconds the start screen waits, it
 * is what moves and says what Lantern does. The example at rest takes the same size, so
 * nothing moves as it becomes the line.
 */
const LINE_SIZE_CLASSES = "type-voice text-body";

/**
 * How few characters may be left before the field says how many: the last fifth of what
 * the intake reads, so a short text never sees a count.
 */
const ROOM_SAID_FROM = MAX_INTAKE_TEXT_CHARS / 5;

/**
 * The field is a line to write on, and focus thickens and darkens that line rather than
 * boxing it: a ring is a second shape, and a field shows it at a mouse's click too. The
 * margin keeps the line's extra pixel from moving what follows. The outline stays, clear,
 * for forced colours, which draw it and drop the line's colour. Its words wrap onto lines of
 * their own, so a phone shows the whole sentence rather than its last few words.
 */
const FIELD_CLASSES =
  "col-start-1 row-start-1 w-full resize-none overflow-hidden border-b border-ink-soft bg-transparent pb-1 type-voice text-dek focus-visible:-mb-px focus-visible:border-b-2 focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-transparent";

/**
 * The field's words as it wraps them, its type, its padding and its line: unseen in its cell,
 * so the field is as tall as its words, and lit over it while they are read.
 */
const FIELD_WORDS_CLASSES =
  "border-b border-transparent pb-1 type-voice text-dek whitespace-pre-wrap wrap-break-word";

/** Over the field, its words where the field draws them. */
const OVER_FIELD_CLASSES = "pointer-events-none absolute inset-0 overflow-hidden";

/**
 * The key code a browser gives a key an input method takes: Safari sends the Enter that ends a
 * composed word after the composition ends, `isComposing` false, with this code alone to say so.
 */
const COMPOSING_KEY_CODE = 229;

/** A pasted text's line breaks, which a sentence for the day has no use for. */
const LINE_BREAKS = /\s*[\r\n]+\s*/g;

/** The one question: a field for the day in one's own words, or for the city asked for. */
function QuestionForm({
  line,
  text,
  onTextChange,
  isLive,
  isCityFocused,
  isFocusedOnMount,
  onPlan,
  onChooseReading,
}: QuestionFormProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const roomId = useId();
  const left = Math.max(0, MAX_INTAKE_TEXT_CHARS - text.length);
  // Read, and then written: the field holds the text it was asked with until the day is here.
  const isReading = line?.kind === "reading" || line?.kind === "writing";
  const isAskingCity = questionOf(line) !== null;
  // The waiting line's light passes through what Lantern is working on (`docs/decisions.md`,
  // "The first screen asks one question, and no day is drawn until a press"): the visitor's words
  // while they are read; it leaves them as the day is written.
  const isFieldLit = line?.kind === "reading";

  useEffect(() => {
    if (isAskingCity && isCityFocused) field.current?.focus();
  }, [isAskingCity, isCityFocused]);
  // Set again for a text after the city's field, it takes the focus that field had.
  const isFocusedOnMountRef = useRef(isFocusedOnMount);
  useEffect(() => {
    if (isFocusedOnMountRef.current) field.current?.focus();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === "" || isReading) return;
    onPlan(text.trim());
  };
  // The field takes a sentence, never a second line: Enter asks for the day, as a one-line
  // field's does, and a word being composed takes its own Enter, the one Safari sends after
  // the composition has ended as well (`COMPOSING_KEY_CODE`).
  const askOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing = event.nativeEvent.isComposing || event.keyCode === COMPOSING_KEY_CODE;
    if (event.key !== "Enter" || isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="group flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex justify-between gap-3 type-note">
            <span className="text-muted transition-colors group-focus-within:text-ink">
              {isAskingCity ? "Which city?" : "Where, and anything else"}
            </span>
            {/* Near its end, the room left: Lantern reads no more than this, so the field
                takes no more, and says so before a pasted text is cut short. Out of the
                field's name, and heard as its description. */}
            {left <= ROOM_SAID_FROM && (
              <span id={roomId} aria-hidden className={left === 0 ? "text-ink" : "text-muted"}>
                {left} left
              </span>
            )}
          </span>
          <span className="relative grid">
            {/* As tall as its words: an unseen copy of them shares the field's cell. */}
            <span
              aria-hidden
              className={cn("invisible col-start-1 row-start-1", FIELD_WORDS_CLASSES)}
            >
              {`${text} `}
            </span>
            <textarea
              ref={field}
              name="text"
              rows={1}
              value={text}
              onChange={(event) => onTextChange(event.target.value.replace(LINE_BREAKS, " "))}
              onKeyDown={askOnEnter}
              enterKeyHint="go"
              readOnly={isReading}
              autoComplete="off"
              // The visitor's own words, a city's name among them: a phone's keyboard corrects a
              // name it does not know, "Nafplio" among them, into a word it does.
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              maxLength={MAX_INTAKE_TEXT_CHARS}
              aria-describedby={left <= ROOM_SAID_FROM ? roomId : undefined}
              className={cn(FIELD_CLASSES, isFieldLit ? "text-transparent" : "text-ink")}
            />
            {isFieldLit && (
              // A field paints no light through its own text, so the light passes through a
              // copy of the words laid over it, wrapped as the field wraps them.
              <span aria-hidden className={OVER_FIELD_CLASSES}>
                <span className={cn("block", FIELD_WORDS_CLASSES)}>
                  <span className={STEADY_WORDS_LIT_CLASSES("ink")}>{text}</span>
                </span>
              </span>
            )}
          </span>
        </label>
        <button
          type="submit"
          aria-disabled={isReading || undefined}
          // Its words share one cell, the others unseen, so it is as wide as its longest and
          // the field beside it never moves as it says what Lantern is doing. While Lantern
          // works the light passes over it too, so its new word is seen to be working.
          className={cn(
            "grid shrink-0 rounded-md bg-ink px-4 py-3 type-voice text-body text-ground focus-ring transition-colors",
            isReading && STEADY_BUTTON_LIT_CLASSES,
          )}
        >
          {BUTTON_LABELS.map((label) => {
            const isSaid = label === buttonLabelOf(line, isLive);
            return (
              <span
                key={label}
                aria-hidden={!isSaid || undefined}
                className={cn("col-start-1 row-start-1 text-center", !isSaid && "invisible")}
              >
                {label}
              </span>
            );
          })}
        </button>
      </div>
      <QuestionLine line={line} text={text} isLive={isLive} onChooseReading={onChooseReading} />
    </form>
  );
}

interface QuestionLineProps {
  line: StartLine;
  /** What the field holds: while an answer is read, the city it names. */
  text: string;
  isLive: boolean;
  onChooseReading: (reading: CityReading) => void;
}

/** Everything the field's button says, by what Lantern is doing with the text. */
const BUTTON_WORDS = {
  plan: "Plan this day",
  reading: "Reading",
  writing: "Writing",
  opening: "Opening",
} as const;

type ButtonLabel = (typeof BUTTON_WORDS)[keyof typeof BUTTON_WORDS];

const BUTTON_LABELS: readonly ButtonLabel[] = Object.values(BUTTON_WORDS);

/** What the field's button says: what Lantern is doing with the text, or what it will. */
function buttonLabelOf(line: StartLine, isLive: boolean): ButtonLabel {
  if (line?.kind === "reading") return BUTTON_WORDS.reading;
  if (line?.kind === "writing") return isLive ? BUTTON_WORDS.writing : BUTTON_WORDS.opening;
  return BUTTON_WORDS.plan;
}

/**
 * The line under the field, holding one line's room whatever it says: a day said back at the
 * body's size takes two lines on a phone, "Opening a lively Sunday in Madrid, out late, with
 * friends" at 360 and 390 px, and its second runs on into the room under it, the gap over the
 * starts or the note's held room, where it pushed the starts down 23 px from under the finger
 * that pressed one.
 */
function SaidLine({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className="relative">
      <span aria-hidden className={cn(LINE_SIZE_CLASSES, "invisible block")}>
        {" "}
      </span>
      <p role="status" className={cn(LINE_SIZE_CLASSES, "absolute inset-x-0 top-0", className)}>
        {children}
      </p>
    </div>
  );
}

/** Under the field: an example, or what Lantern made of the text. */
function QuestionLine({ line, text, isLive, onChooseReading }: QuestionLineProps) {
  if (line === null) {
    // At rest, the example takes the line's size, so the line takes its place as it is.
    return <SaidLine className="text-muted">{EXAMPLE}</SaidLine>;
  }
  if (line.kind === "reading" || line.kind === "writing") {
    // From the Enter the line says what Lantern does, lit as the field's words and the button are:
    // reading the words, then opening the day they ask for.
    const said =
      line.kind === "reading" ? (
        READING_SAID
      ) : (
        <>
          {isLive ? "Writing" : "Opening"} <AskedSentence request={line.request} isMidSentence />
        </>
      );
    // An answer read and its day set off keep the question's lines as they stand, so nothing
    // moves until the day takes the page; screen readers hear what is happening.
    if (line.answering) {
      return (
        <QuestionLines
          question={line.answering}
          answer={{ city: text, said }}
          onChooseReading={onChooseReading}
          isLit
        />
      );
    }
    return <SaidLine className={STEADY_WORDS_LIT_CLASSES("ink-soft")}>{said}</SaidLine>;
  }
  if (line.kind === "question") {
    return <QuestionLines question={line} answer={null} onChooseReading={onChooseReading} />;
  }
  const said = {
    // With live generation on the day cannot be written only when reading failed.
    "not-yet": isLive
      ? "Lantern couldn't read that just now."
      : "Lantern isn't writing new days right now.",
    refused: "Lantern can't plan that day.",
    limited: "Lantern has written all the days it can for now.",
  }[line.kind];
  // The written days are offered once, as the index below, which this points to.
  return (
    <p role="status" className="mt-1 type-voice text-quote text-ink-soft">
      {said} {TO_THE_INDEX}
    </p>
  );
}

interface QuestionLinesProps {
  question: CityQuestion;
  /**
   * The city answered, while it is read and its day sets off, with what screen readers hear
   * of that; null while the question waits for it.
   */
  answer: { city: string; said: ReactNode } | null;
  onChooseReading: (reading: CityReading) => void;
  /** The sentence, its city answered, carries the waiting line's light while the day is written. */
  isLit?: boolean;
}

/**
 * The sentence so far, asking "in …?", and under it what it needs: which of the cities a
 * name could be, or a city at all. While an answer is read, the answer stands in the
 * sentence where "…?" stood, and the lines under it hold their room unseen, so nothing moves
 * when the answer is read and the day sets off, or when the question asks again.
 */
function QuestionLines({ question, answer, onChooseReading, isLit = false }: QuestionLinesProps) {
  const isReading = answer !== null;
  const unplaced = unplacedLineOf(question.unplaced);
  return (
    <div role="status" className="mt-1 flex flex-col gap-1">
      {answer && <span className="sr-only">{answer.said}</span>}
      <QuestionSentence words={question.words} city={answer?.city ?? null} isLit={isLit} />
      <div
        aria-hidden={isReading || undefined}
        inert={isReading}
        className={cn("flex flex-col gap-1", isReading && "invisible")}
      >
        {question.words.energySource === "assumed" && (
          // The dotted word's key, as the facts line under a day gives it.
          <p className="type-note text-muted">
            <span className={ASSUMED_CLASSES}>assumed</span> by Lantern
          </p>
        )}
        {question.readings.length > 0 ? (
          // The answers to the field's "Which city?" stand under the sentence's blank alone:
          // a line that asked it again was heard twice.
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 type-note text-muted">
            {question.readings.map((reading) => (
              <button
                key={reading.placeId}
                type="button"
                onClick={() => onChooseReading(reading)}
                // At least 24 px tall, as WCAG 2.5.8 asks of a target this close to another.
                className={cn(LINK_CLASSES, "py-1 type-voice text-body text-ink")}
              >
                {reading.name}
                <span className="text-muted">, {reading.region}</span>
              </button>
            ))}
          </p>
        ) : (
          <p className="type-note text-muted">
            Lantern needs a city to plan the day. Name one, or pick one of the days below.
          </p>
        )}
        {unplaced && <p className="type-note text-muted">{unplaced}</p>}
      </div>
    </div>
  );
}

/**
 * The words read so far as the sentence, the city asked for: "A calm day in …?, slow
 * morning, with family". Energy is in its own colour, and dotted when Lantern took it because
 * the text named none. A weekday is said only when the text named the date: otherwise the
 * day is today in the city's zone, which no one knows until the city is named, so the
 * sentence says "day".
 */
interface QuestionSentenceProps {
  words: IntakeWords;
  city?: string | null;
  /** Lit, its words take the light with the rest, and only the energy word keeps its colour. */
  isLit?: boolean;
}

function QuestionSentence({ words, city = null, isLit = false }: QuestionSentenceProps) {
  const rest = ASSUMABLE_FACT_KEYS.flatMap((key) => {
    const label = optionOf({ options: FACT_OPTIONS[key] }, words[key])?.label;
    return label === undefined ? [] : [label];
  });
  // Lit, the words inherit the light; at rest each is ink.
  const wordClasses = isLit ? undefined : "text-ink";
  return (
    <p
      className={cn(
        "type-voice text-dek",
        isLit ? STEADY_WORDS_LIT_CLASSES("ink-soft") : "text-ink-soft",
      )}
    >
      A{" "}
      <span className={cn("text-energy", words.energySource === "assumed" && ASSUMED_CLASSES)}>
        {energyLabelOf(words.energy)}
      </span>{" "}
      <span className={wordClasses}>{words.date === null ? "day" : weekdayOf(words.date)}</span> in{" "}
      {city ? <span className={wordClasses}>{city}</span> : <span className="text-muted">…?</span>}
      {rest.map((label) => (
        <span key={label}>
          , <span className={wordClasses}>{label}</span>
        </span>
      ))}
    </p>
  );
}

/** The question the field asks for a city, while it asks, while its answer is read and its day sets off. */
function questionOf(line: StartLine): CityQuestion | null {
  if (line?.kind === "question") return line;
  if (line?.kind === "reading" || line?.kind === "writing") return line.answering ?? null;
  return null;
}

/** The line says no day can be written, in place of the note under the field. */
function isNoDay(line: StartLine): boolean {
  return line?.kind === "not-yet" || line?.kind === "refused" || line?.kind === "limited";
}
