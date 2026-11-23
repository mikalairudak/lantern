"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { flushSync } from "react-dom";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import { ASSUMABLE_FACT_KEYS, type DayRequest } from "@/lib/schema/itinerary.schema";
import { cn } from "@/components/ui/cn";
import { SITE_DESCRIPTION } from "@/lib/site";
import { useHydrated } from "@/components/ui/use-hydrated";
import { SignOfWork } from "@/components/ui/sign-of-work";
import type { SignWork } from "@/components/ui/sign-tally";
import { FACT_OPTIONS, optionOf } from "./facts";
import { ASSUMED_CLASSES, ASSUMED_NOTE } from "./sentence-word";
import { energyLabelOf, weekdayOf } from "./sentence";
import {
  MAX_INTAKE_TEXT_CHARS,
  type CityReading,
  type IntakeWords,
} from "@/lib/schema/intake.schema";
import { unplacedLineOf } from "./start";
import { LINK_CLASSES } from "./link-classes";
import { WHOLE_DAY_TAKES } from "./not-yet";
import { AskedSentence } from "./asked-sentence";
import { Masthead } from "./masthead";
import { STILL_RING_CLASSES, StartIndex } from "./start-index";
import { NOTICE_HEARD_MS } from "./notice-status";
import { YourDaysLedger, type YourDaysProps } from "./your-days-ledger";
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
const EXAMPLE = "For example: London, with friends";
/** Under the field from the visitor's Enter, while Lantern reads their words. */
const READING_SAID = "Reading what you wrote";
/** Under the city's question when the text named no city at all. */
const NEEDS_CITY = "Lantern needs a city to plan the day. Name one, or pick one of the days below.";

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
  /**
   * The wait a typed text is in, as the page holds it, from the press until the page turns to
   * its day or the wait ends without one: none for a day pressed in the index.
   */
  wait: StartWait | null;
  /** A day Lantern has written, chosen: it is written where the question was. */
  onChooseWritten: (request: DayRequest) => void;
  /** One of the cities a shared name could be, chosen as the answer to "in …?". */
  onChooseReading: (reading: CityReading) => void;
  /**
   * The visitor's own days, a line each over the index once there is one. The browser alone
   * keeps them, so the index waits for the list to be read rather than be pushed down by it.
   */
  yourDays?: YourDaysProps;
  /** Shown again by Back from a day: its headline takes the focus the day had. */
  isReturnedTo?: boolean;
  /**
   * The field drawn as focused, or the button as pointed at, still, as a lab cell shows it:
   * one element alone can hold the focus, and a cell that took it would scroll the lab to it.
   */
  drawnAsPointed?: DrawnAsPointed;
}

/**
 * What a lab cell draws as pointed at or focused, still: the field, the button pointed at, or the
 * button with the keyboard's ring.
 */
export type DrawnAsPointed = "field" | "button" | "button-focus" | null;

/**
 * What Lantern is doing in the wait that follows a typed text: reading it, then opening a day it
 * has written already, or writing one. The sign of work stands in the button through it.
 */
export type StartWait = "reading" | "opening" | "writing";

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
  wait: waitAsked,
}: StartHeaderProps) {
  // With live generation off nothing is written: a day on its way is opened from its file.
  const wait = waitAsked === "writing" && !isLive ? "opening" : waitAsked;
  const promise = useRef<HTMLHeadingElement>(null);
  const startsList = useRef<HTMLUListElement>(null);
  // Mounted again by Back, so read once, as it mounts.
  const [isFocusedOnMount] = useState(isReturnedTo);
  useEffect(() => {
    if (isFocusedOnMount) promise.current?.focus({ preventScroll: true });
  }, [isFocusedOnMount]);
  const isHydrated = useHydrated();
  const areStartsDrawn = yourDays === undefined || isHydrated;
  // Forgotten, the list goes with the answer pressed: the first start takes the focus.
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
  // Held here rather than in the form: the status over the form reads it too (`heardOf`), so
  // a press the focus says is not said again from there.
  const [isReadingSaidByFocus, setIsReadingSaidByFocus] = useState(false);
  if (wait === null && isReadingSaidByFocus) setIsReadingSaidByFocus(false);
  // Whether the line came straight after an ending, held while it stays the same kind: an ending
  // takes the line under the field from the page, so a read or a day on its way that follows one
  // draws that line afresh, and the status over the form says it where the focus does not
  // (`isUnderWaySaidOverForm`). A read drawn hands the day on its way to the line it drew.
  const lineKind = line?.kind ?? null;
  const [lastLineKind, setLastLineKind] = useState(lineKind);
  const [isLineAfterEnding, setIsLineAfterEnding] = useState(false);
  if (lastLineKind !== lineKind) {
    setLastLineKind(lineKind);
    setIsLineAfterEnding(isEndingKind(lastLineKind));
  }
  const isSaidOverForm = isUnderWaySaidOverForm(line, isReadingSaidByFocus, isLineAfterEnding);
  // An ending's or the question's words stand in the status for `NOTICE_HEARD_MS`, then it falls
  // quiet while the line seen stays, so a read-through meets them once (`docs/decisions.md`,
  // "How a day ended is said from one status that stands before the ending"). Gone from it, as
  // a wait empties it, they are held afresh when they come back.
  const answer = answerSaidOf(line, wait, isLive);
  const [answerHeardOut, setAnswerHeardOut] = useState<string | null>(null);
  if (answerHeardOut !== null && answerHeardOut !== answer) setAnswerHeardOut(null);
  useEffect(() => {
    if (answer === null) return undefined;
    const heardOut = window.setTimeout(() => setAnswerHeardOut(answer), NOTICE_HEARD_MS);
    return () => window.clearTimeout(heardOut);
  }, [answer]);
  const heardAnswer = answer !== answerHeardOut ? answer : null;

  return (
    <header className="flex shrink-0 flex-col pt-5 pb-5">
      <Masthead isHome />
      {/* A container, so the sentence and its button take their larger size from the column's
          width, as the index under them does, and a phone's cell in the lab reads as a phone. */}
      <div className="@container">
        <h1 ref={promise} tabIndex={-1} className={PROMISE_CLASSES}>
          {PROMISE}
        </h1>
        {/* What Lantern answered, to a screen reader: an ending without a day, the city's
            question, what an answer to it is doing, and a read or a day on its way straight after
            an ending (`isUnderWaySaidOverForm`). A status in the page, empty, from its first paint,
            and over the form the question draws again, so each answer is a change of its words,
            heard where the focus stays and where it moves: a status born holding its words is
            not said by every screen reader. A start screen drawn again with its answer still
            standing, as on the way back from a day, draws it holding that answer, as a notice
            the page opens with, for as long. */}
        <div role="status" className="sr-only">
          {heardAnswer ?? heardOf(line, wait, isLive, isReadingSaidByFocus, isSaidOverForm)}
        </div>
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
          wait={wait}
          isReadingSaidByFocus={isReadingSaidByFocus}
          onReadingSaidByFocus={setIsReadingSaidByFocus}
          isSaidOverForm={isSaidOverForm}
          isAnswerHeardOut={heardAnswer === null}
          onPlan={onPlan}
          onChooseReading={onChooseReading}
          drawnAsPointed={drawnAsPointed}
        />
      </div>
      {yourDays && areStartsDrawn && <YourDaysLedger {...yourDays} onForget={forget} />}
      {areStartsDrawn && (
        <StartIndex
          starts={starts}
          onChoose={onChooseWritten}
          listRef={startsList}
          // While Lantern reads and writes a typed text, the cities on offer step back
          // (`docs/decisions.md`, "The index's pictures step back while Lantern reads and writes").
          isSteppedBack={wait !== null}
        />
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
  wait: StartWait | null;
  /** The press moved the focus to the button, whose name says "Reading" as it lands. */
  isReadingSaidByFocus: boolean;
  onReadingSaidByFocus: (isSaid: boolean) => void;
  /** The line under way is said from the status over the form (`isUnderWaySaidOverForm`). */
  isSaidOverForm: boolean;
  /**
   * The status over the form holds no ending's or question's words, as once they have stood their
   * time.
   */
  isAnswerHeardOut: boolean;
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
 * sentence's own under the text column's width, where the example's own words, "London, with
 * friends", fit the line beside the button at 390 px, and the title's from it. The hero
 * reads the text column off its own container, as the index under it reads the abacus's: the
 * sentence needs a column, not four pictures.
 */
const SENTENCE_CLASSES = "type-voice text-sentence @measure:text-title";

/** The words the field's line starts with, the rest of the line the visitor's. */
const SENTENCE_START = "A day in";

/**
 * The light through what Lantern is working on while the start screen waits (`docs/decisions.md`,
 * "The first screen asks one question, and no day is drawn until a press"): one band fixed to
 * the screen, as the waiting line's is, so the field's words and the line under them light as it
 * passes each, about every second, since a cold start's seconds with a sparser light read as a
 * hang; the button lights with them for a city pressed, and through a typed wait holds the sign
 * of work. Light in words is amber, the colour light is said in, 5:1 and more as words are; the
 * lamp's, which draws light, stands 3.84:1 at the band's peak. It passes through words that stay
 * in their own ink, so nothing reads as switched off, and a word in a colour of its own, the
 * energy's, keeps it. The band stands upright: a slanted one, as the waiting line's is, draws a
 * hard edge across the button on a phone, where the screen's height shifts it sideways out of
 * its own box. With reduced motion the words stand in their ink.
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
 * their own, so a phone shows the whole sentence rather than its last few words. It hides what
 * overflows it, so its first line has 4 px over it (`FIELD_ROOM_CLASSES`): an accent over a
 * capital, Å's ring or the breve of the Cyrillic Short I, stands up to 3.5 px over the title's
 * line.
 */
const FIELD_CLASSES = cn(
  "col-start-1 row-start-1 w-full resize-none overflow-hidden border-b bg-transparent pt-1 pb-1 focus-visible:outline-2 focus-visible:outline-transparent",
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
  "border-b border-transparent pt-1 pb-1 whitespace-pre-wrap wrap-break-word",
  SENTENCE_CLASSES,
  CLEAR_OF_BUTTON_CLASSES,
);

/**
 * The question's line, taken up by the 4 px the field's words have over them, so "A day in", the
 * field's words and everything under them stand where they would without it.
 */
const FIELD_ROOM_CLASSES = "-mt-1 flex items-baseline";

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
  wait,
  isReadingSaidByFocus,
  onReadingSaidByFocus,
  isSaidOverForm,
  isAnswerHeardOut,
  onPlan,
  onChooseReading,
  drawnAsPointed,
}: QuestionFormProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const roomId = useId();
  const answerId = useId();
  const left = Math.max(0, MAX_INTAKE_TEXT_CHARS - text.length);
  // Read, and then written: the field holds the text it was asked with until the day is here.
  const isReading = isUnderWay(line);
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
  // An answer without a day that hands the focus back to the field, as the effects below do,
  // describes the field by its line too, the ending's or what the city's question needs, so a
  // visitor who comes back to the field hears why no day came. Only once the status over the form
  // has fallen quiet, so the line is not said twice as the focus lands (`docs/decisions.md`, "How a
  // day ended is said from one status that stands before the ending"). The field is handed the
  // focus as it mounts in place of the other, or as a typed wait ends on the answer; a line that
  // leaves the answer leaves the description with it.
  const isAnswered = isEnding || line?.kind === "question";
  const isWaiting = wait !== null;
  const [wasWaitingDrawn, setWasWaitingDrawn] = useState(isWaiting);
  const [isFocusHandedBack, setIsFocusHandedBack] = useState(isFocusedOnMount || isCityFocused);
  if (wasWaitingDrawn !== isWaiting) {
    setWasWaitingDrawn(isWaiting);
    setIsFocusHandedBack(!isWaiting);
  }
  if (isFocusHandedBack && !isAnswered) setIsFocusHandedBack(false);
  const isAnswerDescribed = isFocusHandedBack && isAnswerHeardOut;
  const describedBy =
    [isAnswerDescribed && answerId, isCountShown && roomId].filter(Boolean).join(" ") || undefined;

  useEffect(() => {
    if (isAskingCity && isCityFocused) field.current?.focus();
  }, [isAskingCity, isCityFocused]);
  // Set again for a text after the city's field, it takes the focus that field had.
  const isFocusedOnMountRef = useRef(isFocusedOnMount);
  useEffect(() => {
    if (isFocusedOnMountRef.current) field.current?.focus();
  }, []);

  // A typed wait that ends without a day, or asks for the city again, hands the focus back to
  // the field from the button that held it, as a city asked for after a text takes it.
  const wasWaiting = useRef(wait !== null);
  useEffect(() => {
    const hasEnded = wasWaiting.current && wait === null;
    wasWaiting.current = wait !== null;
    if (!hasEnded || !(isNoDay(line) || line?.kind === "question")) return;
    if (document.activeElement === button.current) field.current?.focus();
  }, [wait, line]);

  // At the press the button takes the focus, named for what Lantern is doing, so a phone's
  // keyboard leaves and uncovers the screen for the wait. Where the focus moves to it, from the
  // field at Enter or from wherever a click in WebKit leaves it, a screen reader hears "Reading" as
  // it lands, so the status holds it unheard (`SaidLine`). Where it is on the button already, as a
  // press from the keyboard or a click in Chromium leaves it, nothing moves and the status says
  // it: the line's own, or after an ending, which drew that line afresh, the status over the form.
  // What the press asks is asked first, so the button is named for the wait when the focus lands.
  const handFocusToButton = (isFocusMoving: boolean, isWaitStarting: boolean) => {
    if (isWaitStarting) {
      const isNamedReading = button.current?.getAttribute("aria-label") === BUTTON_WORDS.reading;
      onReadingSaidByFocus(isFocusMoving && isNamedReading);
    }
    button.current?.focus({ preventScroll: true });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim() === "" || isReading) return;
    const isFocusMoving = document.activeElement !== button.current;
    // A press inside a wait already under way, before the line says it, asks nothing new: what
    // the press that started the wait made heard stands.
    const isWaitStarting = wait === null;
    flushSync(() => onPlan(text.trim()));
    handFocusToButton(isFocusMoving, isWaitStarting);
  };
  // One of the cities a shared name could be, pressed: the cities leave the hand with the press,
  // the pressed one holding the focus, so the button takes it, as at a press of its own, rather
  // than the page. It comes from the city, so it moves, and the question stands with no wait. A
  // choice that sets nothing off leaves the cities, and the focus on the one pressed, as they are.
  const chooseReading = (reading: CityReading) => {
    flushSync(() => onChooseReading(reading));
    if (button.current?.getAttribute("aria-label") === BUTTON_WORDS.plan) return;
    handFocusToButton(true, true);
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
      <div className={FIELD_ROOM_CLASSES}>
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
              aria-describedby={describedBy}
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
              ref={button}
              line={line}
              wait={wait}
              isLive={isLive}
              hasWords={text.trim() !== ""}
              drawnAs={
                drawnAsPointed === "button" || drawnAsPointed === "button-focus"
                  ? drawnAsPointed
                  : null
              }
            />
          </div>
          {!isEnding &&
            (line?.kind === "question" ? (
              // The city asked for: its lines take what room they need, the count beside them.
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <QuestionLines
                    question={line}
                    answer={null}
                    onChooseReading={chooseReading}
                    neededId={answerId}
                  />
                </div>
                {count}
              </div>
            ) : (
              // The example's room at the field's whole column, whether or not the count stands
              // over its right end, so the keystroke that brings the count in moves nothing.
              <div className="relative mt-2">
                <QuestionLine
                  line={line}
                  wait={wait}
                  isReadingSaidByFocus={isReadingSaidByFocus}
                  isSaidOverForm={isSaidOverForm}
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
                isUnderWay(line) && !line.answering && "invisible",
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
          <EndingLine id={answerId} ending={line.kind} isLive={isLive} />
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
 * While Lantern opens or writes a day pressed in the index: filled, and the steady light passes
 * over it, so it is seen to be working; with reduced motion it stands in `ink-soft`.
 */
const PLAN_WORKING_CLASSES = cn(
  "border-ink bg-ink text-ground via-amber motion-reduce:border-ink-soft motion-reduce:bg-ink-soft",
  STEADY_PASS_CLASSES,
);

/**
 * Through the wait that follows a typed text: a frame in ink, the hollow button's own, with the
 * sign of work in the arrow's place, the one light on the screen. It takes the state at once, so
 * the sign is never drawn over an ink ground fading out; at rest again it eases as a press does.
 */
const PLAN_SIGN_CLASSES = "border-ink text-ink transition-none";

/**
 * The sign's work through a typed wait: its loop from the press, or with reduced motion its
 * tally, the outline while the text is read and the ribs and the wick once the day is written.
 */
function signWorkOf(wait: StartWait, isReducedMotion: boolean): SignWork {
  if (!isReducedMotion) return { kind: "running" };
  return wait === "reading" ? { kind: "cut", ribs: 0 } : { kind: "wick" };
}

/** What the button is named by, by what Lantern is doing with the text. */
const BUTTON_WORDS = {
  plan: "Plan this day",
  reading: "Reading",
  writing: "Writing",
  opening: "Opening",
} as const;

type ButtonLabel = (typeof BUTTON_WORDS)[keyof typeof BUTTON_WORDS];

/** What the button is named: what Lantern is doing with the text, or what it will. */
function buttonLabelOf(line: StartLine, wait: StartWait | null, isLive: boolean): ButtonLabel {
  if (wait === "reading" || line?.kind === "reading") return BUTTON_WORDS.reading;
  if (wait !== null || line?.kind === "writing") return BUTTON_WORDS[onItsWayOf(wait, isLive)];
  return BUTTON_WORDS.plan;
}

/**
 * What Lantern does with a day on its way, which the button and the line under the field both
 * say: through a typed wait what the wait says, opened from a written day's file or written;
 * for a city pressed, written with live generation on and opened with it off.
 */
function onItsWayOf(wait: StartWait | null, isLive: boolean): "opening" | "writing" {
  if (wait === "opening" || wait === "writing") return wait;
  return isLive ? "writing" : "opening";
}

interface PlanButtonProps {
  ref: Ref<HTMLButtonElement>;
  line: StartLine;
  wait: StartWait | null;
  isLive: boolean;
  /** The field holds words a press would ask with. */
  hasWords: boolean;
  /** Drawn as pointed at, or with the keyboard's ring, still, as a lab cell shows it. */
  drawnAs: "button" | "button-focus" | null;
}

/**
 * The field's button, an arrow to the right: "go on", the way the sentence reads, rather than
 * an arrow up or a paper plane, which say "send". Its name says what a press does, then what
 * Lantern is doing while it works; Enter in the field does the same. Through a typed wait it is a
 * lantern: the sign of work stands in the arrow's place (`docs/brand/README.md`, "The sign of
 * work"), and leaves at once when the wait ends.
 */
function PlanButton({ ref, line, wait, isLive, hasWords, drawnAs }: PlanButtonProps) {
  // Read once the page is hydrated, as the server cannot know it: until then the running sign,
  // whose loop waits behind `motion-safe:`, stands as the outline alone.
  const isHydrated = useHydrated();
  const isReducedMotion = (useReducedMotion() ?? false) && isHydrated;
  // A press waits while the line says Lantern has the text under way; a day on its way that the
  // line does not say back, as one no file holds with live generation off, gives way to a new text.
  const isWorking = isUnderWay(line);
  const stateClasses =
    wait !== null
      ? PLAN_SIGN_CLASSES
      : isWorking
        ? PLAN_WORKING_CLASSES
        : hasWords
          ? PLAN_FILLED_CLASSES
          : PLAN_HOLLOW_CLASSES;
  return (
    <button
      ref={ref}
      type="submit"
      aria-label={buttonLabelOf(line, wait, isLive)}
      aria-disabled={isWorking || undefined}
      data-pointed={drawnAs === "button" || undefined}
      className={cn(
        PLAN_BUTTON_CLASSES,
        stateClasses,
        drawnAs === "button-focus" && STILL_RING_CLASSES,
      )}
    >
      {wait === null ? (
        <ArrowRight aria-hidden size={ICON_SIZES.lg} strokeWidth={ICON_STROKE_WIDTH} />
      ) : (
        <SignOfWork work={signWorkOf(wait, isReducedMotion)} className="size-6" />
      )}
    </button>
  );
}

interface QuestionLineProps {
  line: StartLine;
  wait: StartWait | null;
  /** The press moved the focus to the button, whose name says "Reading" as it lands. */
  isReadingSaidByFocus: boolean;
  /** The line under way is said from the status over the form (`isUnderWaySaidOverForm`). */
  isSaidOverForm: boolean;
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
 * under it never lies under its second line. With live generation on, where no note stands
 * under it, it holds two lines at least (`docs/decisions.md`, "The start screen asks its
 * question as one line"). What it says shares the room's cell with a line's margin less under
 * it, so a day said back may run one line into the room under it, the gap over the index or the
 * note's held room, and each line after that moves the index down by itself: the last line
 * stands 16 px or more over "No city in mind?", never over it, and a day said back in three
 * lines, a typed day with its minute among them, moves nothing.
 */
function SaidLine({
  className,
  isHeard = true,
  isTwoLinesHeld,
  children,
}: {
  className: string;
  /** Holds two lines however short the example, as with live generation on. */
  isTwoLinesHeld: boolean;
  /**
   * Heard as it changes, or seen alone: a typed text's "Reading" is heard where the focus lands,
   * on the button named for it, and a read or a day on its way straight after an ending from the
   * status over the form, and the status holds it unheard, so it is said once.
   */
  isHeard?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid">
      <span
        aria-hidden
        className={cn(
          LINE_SIZE_CLASSES,
          "invisible col-start-1 row-start-1",
          EXAMPLE_CLASSES,
          isTwoLinesHeld && "min-h-two-lines",
        )}
      >
        {EXAMPLE}
      </span>
      <p
        role="status"
        className={cn(LINE_SIZE_CLASSES, "col-start-1 row-start-1 -mb-6 self-start", className)}
      >
        {isHeard ? children : <span aria-hidden>{children}</span>}
      </p>
    </div>
  );
}

/**
 * The example's wrap, balanced where it takes two lines, as at 320 px: "For example: /
 * London, with friends", the text to type whole on its line.
 */
const EXAMPLE_CLASSES = "text-balance";

/** Under the field: the example, or what Lantern does with the text. */
function QuestionLine({
  line,
  wait,
  isReadingSaidByFocus,
  isSaidOverForm,
  text,
  isLive,
  isExampleShown,
  onChooseReading,
}: QuestionLineProps) {
  if (line === null) {
    // At rest, the example takes the line's size, so the line takes its place as it is.
    return (
      <SaidLine className={cn("text-muted", EXAMPLE_CLASSES)} isTwoLinesHeld={isLive}>
        {isExampleShown ? EXAMPLE : null}
      </SaidLine>
    );
  }
  if (line.kind === "reading" || line.kind === "writing") {
    // An answer read and its day set off keep the question's lines as they stand, so nothing
    // moves until the day takes the page; the start's status says what is happening (`heardOf`).
    if (line.answering) {
      return (
        <QuestionLines
          question={line.answering}
          answer={{ city: text, date: line.kind === "writing" ? line.request.date : null }}
          onChooseReading={onChooseReading}
          isLit
        />
      );
    }
    // From the Enter the line says what Lantern does, lit as the field's words are.
    return (
      <SaidLine
        className={STEADY_WORDS_LIT_CLASSES("ink-soft")}
        isHeard={!isSaidByFocus(line, isReadingSaidByFocus) && !isSaidOverForm}
        isTwoLinesHeld={isLive}
      >
        {saidOf(line, wait, isLive)}
      </SaidLine>
    );
  }
  // The city asked for and each ending stand in rows of their own (`QuestionForm`).
  return null;
}

/**
 * What Lantern does with a text under way: reading the words, then opening the day they ask
 * for, or writing it, in under a minute. A day opened from its file, pressed or typed, is said
 * back without the minute: it opens in seconds.
 */
function saidOf(
  line: Extract<StartLine, { kind: "reading" | "writing" }>,
  wait: StartWait | null,
  isLive: boolean,
): ReactNode {
  if (line.kind === "reading") return READING_SAID;
  return (
    <>
      {BUTTON_WORDS[onItsWayOf(wait, isLive)]}{" "}
      <AskedSentence request={line.request} isMidSentence />
      {isLive && wait === "writing" && ` ${WHOLE_DAY_TAKES}`}
    </>
  );
}

/** A typed text's read is heard where the focus lands, on the button named "Reading". */
function isSaidByFocus(line: StartLine, isReadingSaidByFocus: boolean): boolean {
  return line?.kind === "reading" && isReadingSaidByFocus;
}

/**
 * A typed text's read, or a day on its way, said from the start's status over the form: straight
 * after an ending, which took the line under the field from the page, that line is drawn afresh
 * already holding it, a status born full, so where the focus does not say it, the status that
 * stood says it (`docs/decisions.md`, "How a day ended is said from one status that stands before
 * the ending"): a read pressed after one, a city pressed in the index, or a typed text whose day
 * is answered before its read is drawn.
 */
function isUnderWaySaidOverForm(
  line: StartLine,
  isReadingSaidByFocus: boolean,
  isLineAfterEnding: boolean,
): boolean {
  return isLineAfterEnding && !isSaidByFocus(line, isReadingSaidByFocus);
}

/**
 * What the start's status says of a text under way: what an answer to the city's question is
 * doing while it is read and its day sets off, as long as it does, and a read or a day on its way
 * straight after an ending (`isUnderWaySaidOverForm`). Nothing wherever the line under the field
 * or the focus says it.
 */
function heardOf(
  line: StartLine,
  wait: StartWait | null,
  isLive: boolean,
  isReadingSaidByFocus: boolean,
  isSaidOverForm: boolean,
): ReactNode {
  if (!isUnderWay(line)) return null;
  if (!line.answering) return isSaidOverForm ? saidOf(line, wait, isLive) : null;
  return isSaidByFocus(line, isReadingSaidByFocus) ? null : saidOf(line, wait, isLive);
}

/**
 * What the start's status says once a typed wait is over: the ending without a day or the
 * question for a city, in the words they show. Null while a wait is under way, which empties
 * the status of it from the press, so the same answer to a second press is heard again where
 * the status is drawn without it before the answer, as when the intake answers with live
 * generation on.
 */
function answerSaidOf(line: StartLine, wait: StartWait | null, isLive: boolean): string | null {
  if (wait !== null) return null;
  if (isNoDay(line)) return endingSaidOf(line.kind, isLive);
  if (line?.kind === "question") return questionSaidOf(line);
  return null;
}

/** Each ending without a day, which the start screen can show. */
type Ending = "not-yet" | "refused" | "limited";

/** What happened, the first half of an ending's line. */
function endedOf(ending: Ending, isLive: boolean): string {
  return {
    // With live generation on the day cannot be written only when reading failed.
    "not-yet": isLive
      ? "Lantern couldn't read that just now."
      : "Lantern isn't writing new days right now.",
    refused: "Lantern can't plan that day.",
    limited: "Lantern has written all the days it can for now.",
  }[ending];
}

/** What an ending says: what happened, and the way on, the index below. */
function endingSaidOf(ending: Ending, isLive: boolean): string {
  return `${endedOf(ending, isLive)} ${TO_THE_INDEX}`;
}

/**
 * A line that can write no day, as it is seen; the start's status says it (`answerSaidOf`). The
 * written days are offered once, as the index below, which this points to. Its halves stay
 * separate texts: Chromium sets one joined string's glyphs a subpixel apart from these.
 */
function EndingLine({ id, ending, isLive }: { id: string; ending: Ending; isLive: boolean }) {
  return (
    <p id={id} className="mt-1 type-voice text-quote text-ink-soft">
      {endedOf(ending, isLive)} {TO_THE_INDEX}
    </p>
  );
}

/**
 * The city's question in one line, in the words its lines show: the sentence so far, the key
 * of an energy Lantern assumed, naming the word it marks so no fact after it reads as assumed,
 * then the cities its name could be, or that it needs one, and what Lantern could not place.
 */
function questionSaidOf({ words, readings, unplaced }: CityQuestion): string {
  const energy = energyLabelOf(words.energy);
  const sentence = [`A ${energy} ${dayWordOf(words)} in …?`, ...restLabelsOf(words)].join(", ");
  const needed =
    readings.length > 0
      ? `${readings.map((reading) => `${reading.name}, ${reading.region}`).join(", or ")}.`
      : NEEDS_CITY;
  // The sentence ends at its "…?" where it names nothing after the city.
  const asked = sentence.endsWith("?") ? sentence : `${sentence}.`;
  // The key as its line says it, set as a sentence of the status's own.
  const keySaid = assumedKeyOf(words);
  const key = keySaid === null ? null : `${keySaid.charAt(0).toUpperCase()}${keySaid.slice(1)}.`;
  return [asked, key, needed, unplacedLineOf(unplaced)].filter((part) => part !== null).join(" ");
}

/**
 * The key of an energy Lantern assumed, naming the word it marks, "quiet is assumed by Lantern";
 * null for an energy the text named. One text, so Chrome keeps its spaces in a hidden box.
 */
function assumedKeyOf(words: IntakeWords): string | null {
  if (words.energySource !== "assumed") return null;
  return `${energyLabelOf(words.energy)} is ${ASSUMED_NOTE}`;
}

interface QuestionLinesProps {
  question: CityQuestion;
  /**
   * The city answered, while it is read and its day sets off, and the date its day is planned
   * for once the city's zone is known; null while the question waits for it.
   */
  answer: { city: string; date: string | null } | null;
  onChooseReading: (reading: CityReading) => void;
  /** The sentence, its city answered, carries the waiting line's light while the day is written. */
  isLit?: boolean;
  /** The id of the line saying what it needs, which the field may be described by. */
  neededId?: string;
}

/**
 * The sentence so far, asking "in …?", and under it what it needs: which of the cities a
 * name could be, or a city at all. While an answer is read, the answer stands in the
 * sentence where "…?" stood, and the lines under it hold their room unseen, so nothing moves
 * when the answer is read and the day sets off, or when the question asks again. The start's
 * status says them (`answerSaidOf`).
 */
function QuestionLines({
  question,
  answer,
  onChooseReading,
  isLit = false,
  neededId,
}: QuestionLinesProps) {
  const isReading = answer !== null;
  const unplaced = unplacedLineOf(question.unplaced);
  const assumedKey = assumedKeyOf(question.words);
  return (
    <div className="mt-1 flex flex-col gap-1">
      <QuestionSentence
        words={question.words}
        city={answer?.city ?? null}
        planned={answer?.date ?? null}
        isLit={isLit}
      />
      <div
        aria-hidden={isReading || undefined}
        inert={isReading}
        className={cn("flex flex-col gap-1", isReading && "invisible")}
      >
        {assumedKey !== null && (
          // The dotted word's key, as the facts line under a day gives it, naming the word it
          // marks for assistive technology, which hears no dots: heard whole from one hidden
          // text, the words seen kept from it.
          <p className="type-note text-muted">
            <span className="sr-only">{assumedKey}</span>
            <span aria-hidden>
              <span className={ASSUMED_CLASSES}>assumed</span> by Lantern
            </span>
          </p>
        )}
        {question.readings.length > 0 ? (
          // The answers to the field's "Which city?" stand under the sentence's blank alone:
          // a line that asked it again was heard twice.
          <p
            id={neededId}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 type-note text-muted"
          >
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
          <p id={neededId} className="type-note text-muted">
            {NEEDS_CITY}
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
 * sentence says "day". A named day already over in the city answered is planned for today
 * there (`plannedDateOf`), and the sentence then says that weekday, the one the day is
 * written for.
 */
interface QuestionSentenceProps {
  words: IntakeWords;
  city?: string | null;
  /** The date the day is planned for, once the city answered has given its zone. */
  planned?: string | null;
  /** Lit, its words take the light with the rest, and only the energy word keeps its colour. */
  isLit?: boolean;
}

function QuestionSentence({
  words,
  city = null,
  planned = null,
  isLit = false,
}: QuestionSentenceProps) {
  const rest = restLabelsOf(words);
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
      <span className={wordClasses}>{dayWordOf(words, planned)}</span> in{" "}
      {city ? <span className={wordClasses}>{city}</span> : <span className="text-muted">…?</span>}
      {rest.map((label) => (
        <span key={label}>
          , <span className={wordClasses}>{label}</span>
        </span>
      ))}
    </p>
  );
}

/** What the city's sentence says after its city: each fact the text named, by its label. */
function restLabelsOf(words: IntakeWords): string[] {
  return ASSUMABLE_FACT_KEYS.flatMap((key) => {
    const label = optionOf({ options: FACT_OPTIONS[key] }, words[key])?.label;
    return label === undefined ? [] : [label];
  });
}

/** The city's sentence's day: "day", or the weekday the text named, as planned once known. */
function dayWordOf(words: IntakeWords, planned: string | null = null): string {
  return words.date === null ? "day" : weekdayOf(planned ?? words.date);
}

/** The question the field asks for a city, while it asks, while its answer is read and its day sets off. */
function questionOf(line: StartLine): CityQuestion | null {
  if (line?.kind === "question") return line;
  if (line?.kind === "reading" || line?.kind === "writing") return line.answering ?? null;
  return null;
}

/** The line says Lantern has the text under way: read, or its day on its way. */
export function isUnderWay(
  line: StartLine,
): line is Extract<StartLine, { kind: "reading" | "writing" }> {
  return line?.kind === "reading" || line?.kind === "writing";
}

/** The line says no day can be written, in place of the note under the field. */
function isNoDay(line: StartLine): line is { kind: Ending } {
  return isEndingKind(line?.kind ?? null);
}

/** A line of this kind says no day can be written. */
function isEndingKind(kind: NonNullable<StartLine>["kind"] | null): boolean {
  return kind === "not-yet" || kind === "refused" || kind === "limited";
}
