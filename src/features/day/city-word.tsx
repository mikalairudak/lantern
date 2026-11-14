"use client";

import { AnimatePresence, useIsPresent, useReducedMotion, type MotionValue } from "motion/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import type { CityReading } from "@/lib/schema/intake.schema";
import { cn } from "@/components/ui/cn";
import { WordTrail } from "./word-trail";
import { Fold, type FoldExit } from "@/components/ui/fold";
import { requestGistOf } from "./sentence";
import { ASSUMED_CLASSES } from "./sentence-word";
import {
  CurrentCheck,
  HANG_FROM_WORD_CLASSES,
  LIST_BOX_CLASSES,
  LIST_ROW_CLASSES,
  LIST_SHEET_CLASSES,
  OPEN_WORD_CLASSES,
  ROW_NOTE_CLASSES,
  useHangingList,
} from "./word-list";

const WORD_CLASSES = cn(
  "rounded-sm transition-colors underline-offset-4 focus-ring",
  OPEN_WORD_CLASSES,
);
/** The word as it reads when it can be opened: in ink, the hairline under it under a pointer or the keyboard's focus. */
const OPENABLE_CLASSES =
  "text-ink pointed:underline pointed:decoration-ink pointed:decoration-solid pointed:decoration-1";
/** Locked while another word's re-plan is written: muted, with no hover mark, as its words are. */
const LOCKED_CLASSES = "text-muted";
/** A row the keys reach is drawn as a focused option: the ground, and an ink ring inside its edge. */
const ROW_CLASSES = cn(
  LIST_ROW_CLASSES,
  "hover:bg-ground focus-visible:bg-ground focus-ring-inset",
);
/**
 * The field for a city named whole. On a touch screen it takes the list's own size: Safari on a
 * phone zooms the page into a field set under 16 px as it takes the focus, and stays zoomed.
 */
const INPUT_CLASSES =
  "mt-1 block w-full min-w-0 rounded-sm border border-line bg-ground px-2 py-1 font-serif text-small text-ink placeholder:text-muted focus-ring-inset pointer-coarse:text-quote";

/** No readings: a city named whole, or a written day. */
const NO_READINGS: readonly CityReading[] = [];

/**
 * Where the picker puts the focus when it opens: its current row, its field, or nowhere,
 * for a list drawn open rather than opened by a person (a cell in the lab), which leaves
 * the page's focus, and where the page is scrolled, as they were.
 */
export type CityFocus = "current" | "elsewhere" | "nowhere";

/**
 * Why a city typed on the word plays no day: the text named no city, Lantern would not plan
 * it, our own limit answered, or the reading could not run.
 */
export type TypedCityFailure = "no-city" | "refused" | "limited" | "unavailable";

/** A city typed on the word that Lantern has not written: read by the intake, or not played. */
export interface TypedCity {
  name: string;
  /** Null while it is read. */
  failure: TypedCityFailure | null;
}

/** What the list says under its field when a typed city could not be played: the start screen's own lines. */
const FAILURE_WORDS: Record<TypedCityFailure, string> = {
  "no-city": "Lantern needs a city to plan the day.",
  refused: "Lantern can't plan that day.",
  limited: "Lantern has written all the days it can for now.",
  unavailable: "Lantern couldn't read that just now.",
};

interface CityWordProps {
  city: string;
  /** The days Lantern has written, said by their city and what each was written as. */
  written: readonly DayRequest[];
  /** The request on screen, marked "this day" in the list when it is one of them. */
  current: DayRequest;
  /**
   * Every city the name could mean, when the day was played as one of them, in the order the
   * intake gave them; listed first, so another is one press away. Empty for a city named
   * whole.
   */
  readings?: readonly CityReading[];
  /** Which of the readings the day on screen is, by its place id. */
  playedReading?: string | null;
  /** Another of the readings, chosen: the same day in that city. */
  onChooseReading?: (reading: CityReading) => void;
  /** Whether the picker is open, and where its focus goes; null while it is closed. */
  openAt: CityFocus | null;
  onOpenChange: (openAt: CityFocus | null) => void;
  /**
   * A control elsewhere that opens the list at its field, the new day's button: a press on it,
   * or the focus landing on it, is the list's own, and closes nothing.
   */
  ownWord?: RefObject<HTMLElement | null>;
  /** The list's field, which that control puts the focus back in when the list is open already. */
  fieldRef?: RefObject<HTMLInputElement | null>;
  /** A written day, chosen whole: its sentence takes the place of this one. */
  onChooseWritten: (request: DayRequest) => void;
  /** Any other city, as typed. */
  onChooseCity: (city: string) => void;
  /**
   * A city typed that Lantern has not written, while the intake reads it, or once it could
   * not play it: the list stays open on it, its field saying so, and stays the visitor's to
   * close or to try again from. Null when none is.
   */
  typedCity?: TypedCity | null;
  /** The comma after the word, kept on the word's line. */
  trail: string;
  /** A comma that leaves with Lantern's words fades with them. */
  trailOpacity?: MotionValue<number>;
  /** The comma it will have once the sentence is whole, its room held until then. */
  trailRoom?: string;
  /**
   * A choice takes this day's place rather than closing the list: the list goes from sight
   * at once, as a choice always does, but stays, the focus on the row chosen and out of the
   * hand's reach, until the day chosen is drawn and its word takes the focus. Without it, a
   * choice closes the list at once and brings the focus home to the word.
   */
  isChoiceHeld?: boolean;
  /** The day on screen was chosen from this word, so the focus comes back to it. */
  isFocusedOnMount: boolean;
  /**
   * A city Lantern assumed is dotted as its other words are, while there is a day it planned
   * on it; under a notice there is none.
   */
  isAssumptionMarked?: boolean;
  /**
   * Another word's re-plan is being written: the word reads as locked and does not open, and
   * a press on it says so (`onLockedPress`).
   */
  isLocked?: boolean;
  onLockedPress?: () => void;
}

/**
 * The city in the request, a word like the others: opened, it lists the days Lantern has
 * written, each as the sentence it was written for, and takes any other city. Choosing a
 * written day changes the whole sentence, since each was written for its own words. A city
 * Lantern assumed, as the likeliest of the cities its name could mean, is dotted as Lantern's
 * other words are, and its list opens on those cities.
 */
export function CityWord({
  city,
  written,
  current,
  readings = NO_READINGS,
  playedReading = null,
  onChooseReading,
  openAt,
  onOpenChange,
  ownWord,
  fieldRef,
  onChooseWritten,
  onChooseCity,
  typedCity = null,
  trail,
  trailOpacity,
  trailRoom,
  isChoiceHeld = false,
  isFocusedOnMount,
  isAssumptionMarked = true,
  isLocked = false,
  onLockedPress,
}: CityWordProps) {
  const isMarked = isAssumptionMarked && current.citySource === "assumed";
  const button = useRef<HTMLButtonElement>(null);
  const isReducedMotion = useReducedMotion() ?? false;
  // Read when the word takes the focus, not a reason to take it again.
  const scrollBehavior = useRef<ScrollBehavior>(isReducedMotion ? "instant" : "smooth");
  useEffect(() => {
    scrollBehavior.current = isReducedMotion ? "instant" : "smooth";
  });

  // A day chosen from the word replaces the day it was chosen on, word and all. The word
  // takes the focus in the frame it is drawn, from the control that was pressed, so the
  // focus moves once. The page comes up to the word rather than jumping to it, as from a
  // phone's scrolled start screen.
  useLayoutEffect(() => {
    const word = button.current;
    if (!isFocusedOnMount || !word) return;
    word.focus({ preventScroll: true });
    word.scrollIntoView({ block: "nearest", behavior: scrollBehavior.current });
  }, [isFocusedOnMount]);
  const panelId = useId();
  const [exit, setExit] = useState<FoldExit>({ isInstant: false });
  // A choice made, the list stays as it stands until the day chosen takes this one's place.
  const [isHeld, setIsHeld] = useState(false);
  // A typed city the page reads keeps the list in sight rather than held for a day, and one
  // it could not play gives the list back to the hand.
  if (isHeld && typedCity?.failure) setIsHeld(false);
  const isHidden = isHeld && typedCity === null;

  const close = (isFocusReturned: boolean, isInstant = false) => {
    if (isHidden) return;
    // A list closed while a typed city is read gives up the hold its choice took, so the
    // word opens again at once.
    setIsHeld(false);
    // The focus first: its coming home blurs the list, which closes it as a fold, and this
    // close must have the last word on how the list goes.
    if (isFocusReturned) button.current?.focus();
    setExit({ isInstant });
    onOpenChange(null);
  };
  /** A row chosen: the list holds for the day it plays, or goes at once. */
  const choose = (play: () => void) => {
    if (isHeld) return;
    if (isChoiceHeld) setIsHeld(true);
    else close(true, true);
    play();
  };

  return (
    <span className="relative inline-block whitespace-nowrap">
      <button
        ref={button}
        type="button"
        aria-expanded={openAt !== null}
        aria-controls={openAt !== null ? panelId : undefined}
        aria-disabled={isLocked || undefined}
        // Pressed again, the word rolls its list back into itself, as Escape does.
        onClick={() => {
          if (isLocked) return onLockedPress?.();
          if (isHidden) return;
          if (openAt === null) onOpenChange("current");
          else close(true);
        }}
        className={cn(
          WORD_CLASSES,
          isLocked ? LOCKED_CLASSES : OPENABLE_CLASSES,
          isMarked && ASSUMED_CLASSES,
        )}
      >
        {city}
        <WordTrail trail={trail} opacity={trailOpacity} room={trailRoom} />
      </button>
      <AnimatePresence custom={exit}>
        {openAt !== null && (
          <CityPanel
            key="panel"
            id={panelId}
            word={button}
            written={written}
            current={current}
            readings={readings}
            playedReading={playedReading ?? readings[0]?.placeId ?? null}
            focusAt={openAt}
            ownWord={ownWord}
            fieldRef={fieldRef}
            isHidden={isHidden}
            typedCity={typedCity}
            onChooseReading={(reading) => choose(() => onChooseReading?.(reading))}
            onChooseWritten={(request) => choose(() => onChooseWritten(request))}
            onChooseCity={(typed) => choose(() => onChooseCity(typed))}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

interface CityPanelProps {
  id: string;
  /** The city word the list hangs from, which keeps its place and its own press. */
  word: RefObject<HTMLButtonElement | null>;
  written: readonly DayRequest[];
  current: DayRequest;
  readings: readonly CityReading[];
  playedReading: string | null;
  focusAt: CityFocus;
  ownWord?: RefObject<HTMLElement | null>;
  fieldRef?: RefObject<HTMLInputElement | null>;
  /** Held for the day chosen: out of sight and out of the hand's reach, the focus kept. */
  isHidden: boolean;
  typedCity: TypedCity | null;
  onChooseReading: (reading: CityReading) => void;
  onChooseWritten: (request: DayRequest) => void;
  onChooseCity: (city: string) => void;
  onClose: (isFocusReturned: boolean) => void;
}

function CityPanel({
  id,
  word,
  written,
  current,
  readings,
  playedReading,
  focusAt,
  ownWord,
  fieldRef,
  isHidden,
  typedCity,
  onChooseReading,
  onChooseWritten,
  onChooseCity,
  onClose,
}: CityPanelProps) {
  const panel = useRef<HTMLSpanElement>(null);
  const ownInput = useRef<HTMLInputElement>(null);
  const input = fieldRef ?? ownInput;
  const [typed, setTyped] = useState(typedCity?.name ?? "");
  // A city the page reads stands in the field, read-only, until the page answers; one it
  // could not play is left there to be changed.
  const isReading = typedCity !== null && typedCity.failure === null;
  const [shownName, setShownName] = useState(typedCity?.name ?? null);
  if ((typedCity?.name ?? null) !== shownName) {
    setShownName(typedCity?.name ?? null);
    if (typedCity) setTyped(typedCity.name);
  }
  const inputId = useId();
  useHangingList(panel, word, onClose, ownWord);
  // A day played as one of its name's readings is that reading, not a written day of the
  // same name; the rows run the readings first, then the written days.
  const playedIndex = readings.findIndex((reading) => reading.placeId === playedReading);
  const writtenIndex =
    readings.length > 0 ? -1 : written.findIndex((request) => request.city === current.city);
  const currentIndex =
    playedIndex >= 0 ? playedIndex : writtenIndex >= 0 ? readings.length + writtenIndex : 0;
  // Reopened while it rolls back into the word, the list comes back rather than mounting
  // afresh, and takes the focus again as a fresh one would.
  const isPresent = useIsPresent();

  useEffect(() => {
    if (!isPresent || focusAt === "nowhere") return;
    if (focusAt === "elsewhere") {
      input.current?.focus();
      return;
    }
    const rows = panel.current?.querySelectorAll<HTMLButtonElement>("[data-city-row]");
    rows?.[Math.max(0, currentIndex)]?.focus();
  }, [isPresent, focusAt, currentIndex, input]);

  /** Arrow keys move through the rows and the field, wrapping round at the ends. */
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const stops = [
      ...(panel.current?.querySelectorAll<HTMLElement>("[data-city-row], input") ?? []),
    ];
    const at = stops.findIndex((element) => element === document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    event.preventDefault();
    stops[(at + step + stops.length) % stops.length]?.focus();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = typed.trim();
    if (name && !isReading) onChooseCity(name);
  };

  return (
    <span
      ref={panel}
      data-word-list
      id={id}
      role="group"
      aria-label="Where"
      onKeyDown={handleKeyDown}
      // Tabbing on past the field closes it, as the words' pickers close on Tab. A press on
      // the panel's own blank space moves the focus nowhere, and keeps it open; a press on
      // the word is the word's own, which closes it as a toggle.
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node)) return;
        if (panel.current?.contains(next) || word.current?.contains(next)) return;
        if (ownWord?.current?.contains(next)) return;
        onClose(false);
      }}
      className={cn(
        LIST_BOX_CLASSES,
        HANG_FROM_WORD_CLASSES,
        "type-voice text-quote",
        isHidden && "pointer-events-none opacity-0",
      )}
    >
      <Fold as="span" spring="snappy" className={LIST_SHEET_CLASSES}>
        <span className="block py-1">
          {/* Out of the hand's reach while a typed city is read, the field and Escape kept. */}
          <span className="block" inert={isReading}>
            {readings.map((reading) => {
              const isCurrent = reading.placeId === playedReading;
              return (
                <CityRow
                  key={reading.placeId}
                  name={reading.name}
                  note={isCurrent ? `${reading.region} · this day` : reading.region}
                  isCurrent={isCurrent}
                  onPress={() => (isCurrent ? onClose(true) : onChooseReading(reading))}
                />
              );
            })}
            {readings.length > 0 && <Rule />}
            {written.map((request, index) => {
              const isCurrent = index === writtenIndex;
              return (
                <CityRow
                  key={request.city}
                  name={request.city}
                  note={isCurrent ? "this day" : `${requestGistOf(request)}, written`}
                  isCurrent={isCurrent}
                  onPress={() => (isCurrent ? onClose(true) : onChooseWritten(request))}
                />
              );
            })}
          </span>
          <Rule />
          {/* Muted as the rows are until the keys or the pointer reach it. */}
          <form
            onSubmit={submit}
            aria-busy={isReading || undefined}
            className="group/field block px-3 pt-1 pb-2"
          >
            <label
              htmlFor={inputId}
              className="block text-muted transition-colors group-focus-within/field:text-ink group-hover/field:text-ink"
            >
              Somewhere else
            </label>
            <input
              ref={input}
              id={inputId}
              type="text"
              enterKeyHint="go"
              autoComplete="off"
              // A city's name as typed: a phone's keyboard corrects a name it does not know,
              // "Nafplio" among them, into a word it does.
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              placeholder="A city"
              value={typed}
              readOnly={isReading}
              onChange={(event) => setTyped(event.target.value)}
              className={INPUT_CLASSES}
            />
            {/* It wraps within the list's width and never widens it: no row moves as it comes. */}
            {typedCity && (
              <span
                role="status"
                className={cn(
                  "mt-1 block w-0 min-w-full type-note text-pretty",
                  typedCity.failure ? "text-ink-soft" : "text-muted",
                )}
              >
                {typedCity.failure ? FAILURE_WORDS[typedCity.failure] : "Reading"}
              </span>
            )}
          </form>
        </span>
      </Fold>
    </span>
  );
}

/** The hairline between the cities a name could mean, the written days, and any other city. */
function Rule() {
  return <span aria-hidden className="mx-3 my-2 block border-t border-line" />;
}

interface CityRowProps {
  name: string;
  /** Its second line: the region, or what the day was written as, or "this day". */
  note: string;
  isCurrent: boolean;
  onPress: () => void;
}

/**
 * A city in the list: its name, its second line, and the check on the day on screen, in
 * ink, the others muted until the pointer or the keys reach them.
 */
function CityRow({ name, note, isCurrent, onPress }: CityRowProps) {
  return (
    <button
      type="button"
      data-city-row
      aria-current={isCurrent || undefined}
      onClick={onPress}
      className={cn(
        ROW_CLASSES,
        isCurrent ? "text-ink" : "text-muted hover:text-ink focus-visible:text-ink",
      )}
    >
      <span className="block min-w-0 flex-1">
        {name}
        <span className={ROW_NOTE_CLASSES}>{note}</span>
      </span>
      <CurrentCheck isShown={isCurrent} />
    </button>
  );
}
