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
import { ArrowRight } from "lucide-react";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
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
import { StartIndex } from "./start-index";
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
  /**
   * The field drawn as focused, or the button as pointed at, still, as a lab cell shows it:
   * one element alone can hold the focus, and a cell that took it would scroll the lab to it.
   */
  drawnAsPointed?: DrawnAsPointed;
}

/** What a lab cell draws as pointed at or focused, still. */
export type DrawnAsPointed = "field" | "button" | null;

/**
 * The start screen: what Lantern is in one line, one question, and the index of the days Lantern
 * has written. No day is drawn until the visitor asks for one; a day pressed in the index is
 * written where the question was.
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
  drawnAsPointed = null,
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
      {/* A container, so the sentence and its button take their larger size from the column's
          width, as the index under them does, and a phone's cell in the lab reads as a phone. */}
      <div className="@container">
        <h1 ref={promise} tabIndex={-1} className={PROMISE_CLASSES}>
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
          drawnAsPointed={drawnAsPointed}
        />
      </div>
      {yourDays && areStartsDrawn && <YourDaysList {...yourDays} onForget={forget} />}
      {areStartsDrawn && (
        <StartIndex starts={starts} onChoose={onChooseWritten} listRef={startsList} />
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
  drawnAsPointed: DrawnAsPointed;
}

/**
 * What Lantern is, over the question: a small line in the italic Lantern describes in, the
 * page's heading. Balanced, so where it takes two lines they part at the comma, where a greedy
 * wrap breaks wherever the measure cuts; at 320 px it takes three.
 */
const PROMISE_CLASSES =
  "mt-5 max-w-measure type-prose text-quote text-balance text-ink-soft @measure:text-dek";

/**
 * The question's sentence, "A day in" and the visitor's words on one line, in one size: the
 * sentence's own under the text column's width, where the example's own words, "Bologna, with
 * friends", still fit the line beside the button at 390 px, and the title's from it. The hero
 * reads the text column off its own container, as the index under it reads the abacus's: the
 * sentence needs a column, not four pictures.
 */
const SENTENCE_CLASSES = "type-voice text-sentence @measure:text-title";

/** The words the field's line starts with, the rest of the line the visitor's. */
const SENTENCE_START = "A day in";

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
 * The room the field's words keep clear of the button at the line's right end, on every line
 * they wrap to, so a word never runs under it: the button's side and a 12 px gap.
 */
const CLEAR_OF_BUTTON_CLASSES = "pr-11 @measure:pr-12";

/**
 * The field is a line to write on, and focus thickens and darkens that line rather than
 * boxing it: a ring is a second shape, and a field shows it at a mouse's click too. The
 * margin keeps the line's extra pixel from moving what follows. The outline stays, clear,
 * for forced colours, which draw it and drop the line's colour. Its words wrap onto lines of
 * their own, so a phone shows the whole sentence rather than its last few words.
 */
const FIELD_CLASSES = cn(
  "col-start-1 row-start-1 w-full resize-none overflow-hidden border-b bg-transparent pb-1 focus-visible:outline-2 focus-visible:outline-transparent",
  SENTENCE_CLASSES,
  CLEAR_OF_BUTTON_CLASSES,
);
/** The field's line at rest, and in ink at 2 px while it has the focus. */
const FIELD_LINE_CLASSES =
  "border-ink-soft focus-visible:-mb-px focus-visible:border-b-2 focus-visible:border-ink";
/** The field's line as the focus draws it, held still for a lab cell. */
const FIELD_LINE_FOCUSED_CLASSES = "-mb-px border-b-2 border-ink";

/**
 * The field's words as it wraps them, its type, its padding and its line: unseen in its cell,
 * so the field is as tall as its words, and lit over it while they are read.
 */
const FIELD_WORDS_CLASSES = cn(
  "border-b border-transparent pb-1 whitespace-pre-wrap wrap-break-word",
  SENTENCE_CLASSES,
  CLEAR_OF_BUTTON_CLASSES,
);

/** Over the field, its words where the field draws them. */
const OVER_FIELD_CLASSES = "pointer-events-none absolute inset-0 overflow-hidden";

/**
 * The key code a browser gives a key an input method takes: Safari sends the Enter that ends a
 * composed word after the composition ends, `isComposing` false, with this code alone to say so.
 */
const COMPOSING_KEY_CODE = 229;

/** A pasted text's line breaks, which a sentence for the day has no use for. */
const LINE_BREAKS = /\s*[\r\n]+\s*/g;

/**
 * The one question, as one line at every width: "A day in" and the field on one baseline, the
 * field taking the rest of the line over its rule, and the button standing at the rule's right
 * end. Under the field, in its column, the example or what Lantern does with the text, or the
 * room left in the example's place at that row's right end, under the button; and with live
 * generation off, the note under them. An ending without a day stands under the hero at the
 * page's edge instead (`docs/decisions.md`, "The start screen asks its question as one line").
 */
function QuestionForm({
  line,
  text,
  onTextChange,
  isLive,
  isCityFocused,
  isFocusedOnMount,
  onPlan,
  onChooseReading,
  drawnAsPointed,
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
  // Near its end, the room left: Lantern reads no more than this, so the field takes no more,
  // and says so before a pasted text is cut short. Out of the field's name, and heard as its
  // description; not while Lantern reads or writes, when the field is read-only and the line
  // under it needs the whole column.
  const isCountShown = left <= ROOM_SAID_FROM && !isReading;
  const count = isCountShown && (
    <span
      id={roomId}
      aria-hidden
      className={cn("type-note whitespace-nowrap", left === 0 ? "text-ink" : "text-muted")}
    >
      {left} left
    </span>
  );
  const isEnding = isNoDay(line);

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
    <form onSubmit={submit} className="mt-6 flex flex-col">
      <div className="flex items-baseline">
        {/* The sentence's start, read before the field as it is seen; the field keeps its own
          name, what to write in it. */}
        <span className={cn("mr-2 shrink-0 whitespace-nowrap text-ink", SENTENCE_CLASSES)}>
          {SENTENCE_START}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative grid">
            {/* As tall as its words: an unseen copy of them shares the field's cell, and gives the
              line the baseline "A day in" stands on. */}
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
              aria-label={isAskingCity ? "Which city?" : "Where, and anything else"}
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
              aria-describedby={isCountShown ? roomId : undefined}
              className={cn(
                FIELD_CLASSES,
                drawnAsPointed === "field" ? FIELD_LINE_FOCUSED_CLASSES : FIELD_LINE_CLASSES,
                isFieldLit ? "text-transparent" : "text-ink",
              )}
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
            <PlanButton
              line={line}
              isLive={isLive}
              hasWords={text.trim() !== ""}
              isDrawnAsPointed={drawnAsPointed === "button"}
            />
          </div>
          {!isEnding &&
            (line?.kind === "question" ? (
              // The city asked for: its lines take what room they need, the count beside them.
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <QuestionLines question={line} answer={null} onChooseReading={onChooseReading} />
                </div>
                {count}
              </div>
            ) : (
              // The example's room at the field's whole column, whether or not the count stands
              // over its right end, so the keystroke that brings the count in moves nothing.
              <div className="relative mt-2">
                <QuestionLine
                  line={line}
                  text={text}
                  isLive={isLive}
                  isExampleShown={!isCountShown}
                  onChooseReading={onChooseReading}
                />
                {count && <span className="absolute top-0 right-0">{count}</span>}
              </div>
            ))}
          {/* A line saying no day can be written says it in place of the note, not twice. While
            Lantern opens a day the note keeps its room unseen, for the line's second line. */}
          {!isLive && !isEnding && (
            <p
              className={cn(
                "mt-1 type-note text-muted",
                (line?.kind === "reading" || line?.kind === "writing") &&
                  !line.answering &&
                  "invisible",
              )}
            >
              {NOT_LIVE_NOTE}
            </p>
          )}
        </div>
      </div>
      {/* An ending without a day is the hero's last word: it stands at the page's edge across
          the whole column, where it has a measure for two sentences and points to the index
          it stands over, the count at the row's right end beside it. */}
      {isNoDay(line) && (
        <div className="mt-2 flex items-start justify-between gap-3">
          <EndingLine ending={line.kind} isLive={isLive} />
          {count}
        </div>
      )}
    </form>
  );
}

/**
 * The button: a square at the field's rule's right end, its foot 6 px over the rule's top
 * pixel and the rule running on under it, 32 px under the text column's width and 36 px from
 * it, framed in ink, with a hit area 44 px square round its centre. The foot is the keyboard's
 * ring under it, 4 px, and 2 px to keep the ring off the rule. A square, since a disc at a
 * line's end reads as a slider's handle and a disc round an arrow as a chat's send.
 */
const PLAN_BUTTON_CLASSES =
  "absolute right-0 bottom-px mb-1.5 grid size-8 place-items-center rounded-sm border focus-ring transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 @measure:size-9";
/**
 * With the field empty: hollow, its arrow in ink, and filled in ink when pointed at, reached
 * by the keyboard or pressed. A touch screen, which cannot hover, shows the press alone.
 */
const PLAN_HOLLOW_CLASSES =
  "border-ink text-ink pointed:bg-ink pointed:text-ground active:bg-ink active:text-ground";
/** With words in the field: filled in ink, and in `ink-soft` when pointed at or pressed. */
const PLAN_FILLED_CLASSES =
  "border-ink bg-ink text-ground pointed:border-ink-soft pointed:bg-ink-soft active:border-ink-soft active:bg-ink-soft";
/**
 * While Lantern reads, writes or opens: filled, and the steady light passes over it in place
 * of a changed glyph, so it is seen to be working; with reduced motion it stands in `ink-soft`.
 */
const PLAN_WORKING_CLASSES = cn(
  "border-ink bg-ink text-ground via-amber motion-reduce:border-ink-soft motion-reduce:bg-ink-soft",
  STEADY_PASS_CLASSES,
);

/** What the button is named by, by what Lantern is doing with the text. */
const BUTTON_WORDS = {
  plan: "Plan this day",
  reading: "Reading",
  writing: "Writing",
  opening: "Opening",
} as const;

type ButtonLabel = (typeof BUTTON_WORDS)[keyof typeof BUTTON_WORDS];

/** What the button is named: what Lantern is doing with the text, or what it will. */
function buttonLabelOf(line: StartLine, isLive: boolean): ButtonLabel {
  if (line?.kind === "reading") return BUTTON_WORDS.reading;
  if (line?.kind === "writing") return isLive ? BUTTON_WORDS.writing : BUTTON_WORDS.opening;
  return BUTTON_WORDS.plan;
}

interface PlanButtonProps {
  line: StartLine;
  isLive: boolean;
  /** The field holds words a press would ask with. */
  hasWords: boolean;
  /** Drawn as pointed at, still, as a lab cell shows it. */
  isDrawnAsPointed: boolean;
}

/**
 * The field's button, an arrow to the right: "go on", the way the sentence reads, rather than
 * an arrow up or a paper plane, which say "send". Its name says what a press does, then what
 * Lantern is doing while it works; Enter in the field does the same.
 */
function PlanButton({ line, isLive, hasWords, isDrawnAsPointed }: PlanButtonProps) {
  const isWorking = line?.kind === "reading" || line?.kind === "writing";
  return (
    <button
      type="submit"
      aria-label={buttonLabelOf(line, isLive)}
      aria-disabled={isWorking || undefined}
      data-pointed={isDrawnAsPointed || undefined}
      className={cn(
        PLAN_BUTTON_CLASSES,
        isWorking ? PLAN_WORKING_CLASSES : hasWords ? PLAN_FILLED_CLASSES : PLAN_HOLLOW_CLASSES,
      )}
    >
      <ArrowRight aria-hidden size={ICON_SIZES.lg} strokeWidth={ICON_STROKE_WIDTH} />
    </button>
  );
}

interface QuestionLineProps {
  line: StartLine;
  /** What the field holds: while an answer is read, the city it names. */
  text: string;
  isLive: boolean;
  /** At rest, the example is drawn; while the count stands, the line says one thing, the count. */
  isExampleShown: boolean;
  onChooseReading: (reading: CityReading) => void;
}

/**
 * The line under the field, holding the example's room whatever it says: one line, or two
 * where the field's column is narrower than the example, as on a 320 px phone, so the note
 * under it never lies under its second line. What it says shares the room's cell with a line's
 * margin less under it, so a day said back may run one line into the room under it, the gap
 * over the index or the note's held room, and each line after that moves the index down by
 * itself: the last line stands 16 px or more over "No city in mind?", never over it, and a
 * pressed city's day, said in two lines, moves nothing.
 */
function SaidLine({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className="grid">
      <span
        aria-hidden
        className={cn(LINE_SIZE_CLASSES, "invisible col-start-1 row-start-1", EXAMPLE_CLASSES)}
      >
        {EXAMPLE}
      </span>
      <p
        role="status"
        className={cn(LINE_SIZE_CLASSES, "col-start-1 row-start-1 -mb-6 self-start", className)}
      >
        {children}
      </p>
    </div>
  );
}

/**
 * The example's wrap, balanced where it takes two lines, as at 320 px: "For example: /
 * Bologna, with friends", the text to type whole on its line.
 */
const EXAMPLE_CLASSES = "text-balance";

/** Under the field: the example, or what Lantern does with the text. */
function QuestionLine({ line, text, isLive, isExampleShown, onChooseReading }: QuestionLineProps) {
  if (line === null) {
    // At rest, the example takes the line's size, so the line takes its place as it is.
    return (
      <SaidLine className={cn("text-muted", EXAMPLE_CLASSES)}>
        {isExampleShown ? EXAMPLE : null}
      </SaidLine>
    );
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
  // The city asked for and each ending stand in rows of their own (`QuestionForm`).
  return null;
}

/** Each ending without a day, which the start screen can show. */
type Ending = "not-yet" | "refused" | "limited";

/** A line that can write no day: what happened, and the way on, the index below. */
function EndingLine({ ending, isLive }: { ending: Ending; isLive: boolean }) {
  const said = {
    // With live generation on the day cannot be written only when reading failed.
    "not-yet": isLive
      ? "Lantern couldn't read that just now."
      : "Lantern isn't writing new days right now.",
    refused: "Lantern can't plan that day.",
    limited: "Lantern has written all the days it can for now.",
  }[ending];
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
        "type-voice text-quote",
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
function isNoDay(line: StartLine): line is { kind: Ending } {
  return line?.kind === "not-yet" || line?.kind === "refused" || line?.kind === "limited";
}
