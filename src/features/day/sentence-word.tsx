"use client";

import { AnimatePresence, useIsPresent, type MotionValue } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Ink } from "@/components/ui/ink";
import { cn } from "@/components/ui/cn";
import { ICON_SIZES, ICON_STROKE_WIDTH } from "@/lib/tokens/icon";
import type { FactKey, FactSource } from "./facts";
import { Fold, type FoldExit } from "@/components/ui/fold";
import { FadeIn } from "@/components/ui/fade-in";
import { useWrittenText } from "@/components/ui/use-written-text";
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
import { WordTrail } from "./word-trail";

/** One answer in a word's picker. */
export interface OptionView {
  value: string;
  label: string;
  /** One short line on what choosing it would change; null where it says nothing new. */
  consequence: string | null;
  isCurrent: boolean;
  /** Drawn before its words, as the theme's answers are; most answers are words alone. */
  icon?: LucideIcon;
}

/** The fork's other answer, set after a word as its pair. */
export interface WordPair {
  label: string;
  /** Its proposal is being written: the steady light runs through it. */
  isLit: boolean;
  /** Takes the visitor to the fork's first row. */
  onPoint: () => void;
}

/** The words that join a word to its pair, in the sentence's quiet ink. */
const PAIR_JOIN = " or ";

/** A changeable word of the request, as the sentence shows it. */
export interface WordView {
  key: FactKey;
  label: string;
  source: FactSource;
  /** Words a revision struck out, set before the word; null when there are none. */
  struck: string | null;
  options: readonly OptionView[];
  /** The picker's name for screen readers, such as "Who is coming". */
  listLabel: string;
}

/**
 * The dotted underline that marks an assumption, shared with its key in the facts line: in
 * muted ink, as quiet as an open question, so a headline of assumptions does not read as
 * corrected. A pointer's hover replaces the dots with the ink line every word takes.
 */
export const ASSUMED_CLASSES = "underline decoration-muted decoration-dotted underline-offset-4";

/** How each word reads at rest: energy in its colour, the visitor's ink, Lantern's dotted, the question. */
export function wordClassesOf(view: Pick<WordView, "key" | "source">): string {
  const ink = view.key === "energy" ? "text-energy" : "text-ink";
  if (view.source === "assumed") return `${ink} ${ASSUMED_CLASSES}`;
  if (view.key === "energy") return ink;
  if (view.source === "asked") return "text-muted";
  return "text-ink";
}

/**
 * A word that cannot be changed while another word's re-plan is written: muted, every word
 * alike, its energy's colour too, and an assumption keeping its dots, which say whose word it
 * is rather than that it can be pressed.
 */
function lockedClassesOf(view: Pick<WordView, "source">): string {
  return view.source === "assumed" ? `text-muted ${ASSUMED_CLASSES}` : "text-muted";
}

/**
 * The steady light through a fork's proposed answer while Lantern writes it, the start screen's
 * while it opens a day (`docs/decisions.md`, "The first screen asks one question, and no day is
 * drawn until a press"): one band about every second, amber through the answer's own blue
 * (`word-lit`). With reduced motion it stands in its blue.
 */
const LIT_WORD_CLASSES = "word-lit";

/**
 * Where a word stands in a re-plan of it: "writing" while the re-plan streams, the visitor's
 * new answer written in place over the old one; "after" once it has ended, landed, kept or
 * undone, when the word changes at once, as one already read; null for any other word.
 */
export type WordReplanning = "writing" | "after" | null;

/**
 * One hover mark for every word: a solid hairline underline, which replaces an
 * assumption's dots while the pointer is on it. Focus is an ink ring.
 */
const HOVER_CLASSES =
  "hover:underline hover:decoration-ink hover:decoration-solid hover:decoration-1 underline-offset-4";
const BUTTON_CLASSES = "rounded-sm transition-colors focus-ring";
/**
 * The list keeps the focus while the arrows move the active option, so it wears a line
 * ring of its own, and the active option is drawn as the city word's focused row: the
 * ground, and an ink ring inside its edge, only while the list has the keyboard's focus.
 */
const LIST_CLASSES =
  "group/list block py-1 focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-line";
const ACTIVE_OPTION_CLASSES =
  "group-focus-visible/list:bg-ground group-focus-visible/list:outline-2 group-focus-visible/list:-outline-offset-2 group-focus-visible/list:outline-ink";
/** The headline's words hang their lists at the quote's size, the masthead's icon at the body's. */
const HANG_CLASSES = {
  word: cn(HANG_FROM_WORD_CLASSES, "type-voice text-quote"),
  icon: "top-full right-0 mt-3 type-voice text-body",
} as const;

interface SentenceWordProps {
  view: WordView;
  /** Text written in with the word, before it: the open question's space. */
  lead?: string;
  /** The comma after the word, kept on the word's line. */
  trail?: string;
  /** A comma that leaves with Lantern's words fades with them. */
  trailOpacity?: MotionValue<number>;
  /** The comma it will have once the sentence is whole, its room held until then. */
  trailRoom?: string;
  /** Not written yet: the open question waits until the day is written. */
  isHeld?: boolean;
  /**
   * The word Lantern will write here once the pen reaches it: its room is held unseen from
   * the frame it is known, its comma with it, so the words after it never move as it is
   * written in. Left out, the word takes its room as it is written.
   */
  reserved?: string;
  /** Once let go, the word stands whole at once rather than being written in. */
  isShownWhole?: boolean;
  /** Told once the word stands whole, as it is to rest. */
  onWhole?: () => void;
  /**
   * Told in the frame its first letter shows, before it is painted, so the comma of the word
   * before it comes with that letter and never stands alone.
   */
  onSeen?: () => void;
  /**
   * The pen stops where it is, mid-word too, and goes on from there once let go: as a day
   * fades, only its opacity changes.
   */
  isStill?: boolean;
  /**
   * A revision that ends lets its struck words go and the word stand at once, in place; by
   * default the struck words fold away and the word is written over.
   */
  isRevisionEndedAtOnce?: boolean;
  /**
   * Where the word stands in a re-plan of it. Its new answer is written in place by the pen,
   * the letters the two share kept and nothing struck; once the re-plan has ended, the word
   * the day then says stands at once, whether the new one stays or the old comes back.
   */
  replanning?: WordReplanning;
  /**
   * The answer its re-plan replaces, as the sentence said it. While the re-plan is written the
   * word holds the room of both answers, the wider standing, from the press until the day
   * lands. Null where the header measured that the new answer alone keeps the sentence's
   * lines, so nothing is held beyond the pen's own room. Left out, the word the pen writes
   * over stands for it.
   */
  formerLabel?: string | null;
  /** Words can be opened only while the day can be changed. */
  isEnabled: boolean;
  /**
   * Another word's re-plan is being written: the word reads as locked, muted and with no
   * hover mark, and a press on it says so (`onLockedPress`) and does nothing else.
   */
  isLocked?: boolean;
  onLockedPress?: () => void;
  /**
   * The fork's other answer after the word, while a changed word's proposal is drawn beside the
   * day (`docs/decisions.md`, "A changed word proposes its part beside the day, and the visitor
   * takes it"): "early dinner or eating late", the pen writing " or" and the answer in, the
   * answer in the versions' blue, lit while it is written. Pressed, it points to the fork: the
   * page scrolls its first row into view and gives it the focus. Null where there is no pair.
   */
  pair?: WordPair | null;
  /**
   * Its list is drawn open, as a lab cell draws it: open from a frame after it is drawn,
   * taking no focus, so no cell takes the page's from another.
   */
  isDrawnOpen?: boolean;
  /**
   * Drawn anew for the word the visitor changed, as a re-plan merges it: it takes back the
   * focus the word it replaces had, when nothing else has it.
   */
  isFocusedOnMount?: boolean;
  onChoose: (value: string) => void;
  /** The word is under the pointer or the focus, so the stops it shaped light up. */
  onLight: (isLit: boolean) => void;
  /** Told when its list opens, and when it closes or the word goes. */
  onOpenChange?: (isOpen: boolean) => void;
}

/**
 * A changeable word of the request, and its picker. Opened, the word stays where it is, its
 * underline turned solid, and the list unrolls beneath it over the page, so nothing below
 * moves; the current option carries a quiet ink check. A revision sets the struck words
 * before the word, and the word writes in after them.
 */
export function SentenceWord({
  view,
  lead = "",
  trail = "",
  trailOpacity,
  trailRoom,
  isHeld = false,
  reserved,
  isShownWhole = false,
  onWhole,
  onSeen,
  isStill = false,
  isRevisionEndedAtOnce = false,
  replanning = null,
  formerLabel,
  isEnabled,
  isLocked = false,
  onLockedPress,
  pair = null,
  isDrawnOpen = false,
  isFocusedOnMount = false,
  onChoose,
  onLight,
  onOpenChange,
}: SentenceWordProps) {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (!isDrawnOpen) return undefined;
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [isDrawnOpen]);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  // A choice takes the word's place at once; any other close rolls the list back into it.
  const [exit, setExit] = useState<FoldExit>({ isInstant: false });
  const button = useRef<HTMLButtonElement>(null);
  // In the frame it is drawn, so the focus never rests on the page between the two words.
  useLayoutEffect(() => {
    const word = button.current;
    const isLost = document.activeElement === null || document.activeElement === document.body;
    if (isFocusedOnMount && word && isLost) word.focus({ preventScroll: true });
  }, [isFocusedOnMount]);
  const listId = useId();
  // Whether the word's last change stands at once, until it changes again. A revision that
  // ended: a re-plan that dropped erased its struck word and the new one letter by letter and
  // wrote the old one back, the headline a line shorter for half a second on a phone. And a
  // word changed as its re-plan ended or after, its new answer kept, the old one back, or
  // either brought back, which the visitor has already read: only the press brings it in.
  const [change, setChange] = useState({
    struck: view.struck,
    label: view.label,
    replanning,
    isAtOnce: false,
    isFaded: false,
    rewrittenFrom: null as string | null,
  });
  const isChanged = change.struck !== view.struck || change.label !== view.label;
  const isRevisionEnd = isRevisionEndedAtOnce && change.struck !== null && view.struck === null;
  const isReplanEnd = change.replanning === "writing" && replanning !== "writing";
  const isAtOnce = isChanged
    ? isRevisionEnd || isReplanEnd || replanning === "after"
    : change.isAtOnce;
  // A word that takes another's place is one the page knows, the visitor's pick or the day
  // before's: it comes in whole, in a quick fade, and the pen writes only a word the model
  // first gives, where nothing stood.
  const isFaded = isChanged
    ? change.label !== "" && view.label !== "" && change.label !== view.label && !view.struck
    : change.isFaded;
  // The word a re-plan's press replaces, from the press until its next change: its room is
  // held beside the new word's while the re-plan is written.
  const rewrittenFrom = isChanged
    ? replanning === "writing" && !isAtOnce
      ? change.label
      : null
    : change.rewrittenFrom;
  if (isChanged || change.replanning !== replanning) {
    setChange({
      struck: view.struck,
      label: view.label,
      replanning,
      isAtOnce,
      isFaded,
      rewrittenFrom,
    });
  }
  const written = useWrittenText(
    isHeld ? "" : `${lead}${view.label}`,
    isAtOnce || isShownWhole ? "instant" : isFaded ? "fade" : view.struck ? "replace" : "keep",
    false,
    isStill,
  );
  const struck = useWrittenText(view.struck ?? "", isAtOnce ? "instant" : "whole", false, isStill);
  // The pair's words, written in after the word and out again as the fork settles.
  const paired = useWrittenText(pair ? `${PAIR_JOIN}${pair.label}` : "", "keep", false, isStill);
  // Shown, as the word is, up to its last letter: a space written waits for the letter after
  // it, so the comma after the pair never stands apart, "early dinner ,", as it is written in
  // or out.
  const pairJoin = paired.text.slice(0, PAIR_JOIN.length).trim();
  const pairWord = paired.text.slice(PAIR_JOIN.length).trimEnd();
  const isPairShown = pairJoin !== "";
  // Written up to a space, the word waits for its next letter before showing it, so its
  // comma never stands apart.
  const word = written.text.slice(lead.length).trimEnd();
  // While the pen still writes a re-plan's word, one the model first gives where none stood,
  // the room of the whole word, so the words after it never move a letter at a time. A word
  // that takes another's place comes in whole and needs none.
  const rewriteRoom =
    rewrittenFrom !== null && written.isWriting
      ? view.label.startsWith(word)
        ? view.label
        : rewrittenFrom
      : undefined;
  // What the pen has still to write of the word Lantern will write here, held unseen with
  // its comma: written into room already open, Lantern's "on foot" no longer pushed the
  // visitor's "slow morning" along its line a letter at a time.
  const room = rewriteRoom ?? reserved;
  // While a re-plan is written, both answers' room, each with its comma, the wider standing,
  // reduced motion too: so a shorter answer never lets the words after it up a line before
  // the day lands. Holding only the new word's once written, Lisbon's "eating late", narrower
  // than "early dinner", let "home by eleven," up a line on a phone, a band left under the
  // headline until the day landed. Where the header finds the shorter answer keeps the lines,
  // nothing is held: held there too, a hole of 100 to 180 px stood after its comma.
  const former = formerLabel === undefined ? rewrittenFrom : formerLabel;
  const heldRooms =
    replanning === "writing" && former !== null && former !== view.label
      ? [former, view.label]
      : [];
  const unwritten =
    room !== undefined && !struck.text && room !== word && room.startsWith(word)
      ? room.slice(word.length)
      : "";
  // Words struck by a revision keep the space before them while the new word starts over,
  // and so does a word whose room is held.
  const shownLead = struck.text || unwritten ? lead : written.text.slice(0, lead.length);
  // The space after struck words waits for the word, so a comma never stands apart.
  const struckSpace = struck.text && word ? " " : "";
  // The word's box stays while the word is rewritten, so the focus a choice hands back to it
  // is not lost while the old word unwrites and the new one writes in.
  const isBoxShown = word !== "" || struck.text !== "" || written.isWriting;
  // Its comma comes with its first letter, or stays with words struck before it: before
  // that the comma of the word before it stands alone, and two would meet.
  // Held with its room, it comes as the word is whole, where it was held: with its first
  // letter it would stand before the room of the letters still to come.
  const isTrailShown = (word !== "" || struck.text !== "") && !unwritten;
  const shownTrail = isTrailShown ? trail : "";
  // The comma stands after the pair while it does, so "early dinner or eating late," reads as
  // one answer.
  const wordTrail = isPairShown ? "" : shownTrail;
  const isWhole = !isHeld && !written.isWriting && word === view.label;
  const onWholeRef = useRef(onWhole);
  useEffect(() => {
    onWholeRef.current = onWhole;
  });
  useEffect(() => {
    if (isWhole) onWholeRef.current?.();
  }, [isWhole]);
  const isSeen = word !== "";
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  });
  useLayoutEffect(() => {
    if (isSeen) onSeenRef.current?.();
  }, [isSeen]);
  const isOpenable = isEnabled && isOpen;
  useEffect(() => {
    if (!isOpenable) return undefined;
    onOpenChangeRef.current?.(true);
    return () => onOpenChangeRef.current?.(false);
  }, [isOpenable]);

  const close = useCallback((isFocusReturned: boolean, isInstant = false) => {
    setExit({ isInstant });
    setIsOpen(false);
    if (isFocusReturned) button.current?.focus();
  }, []);

  return (
    <>
      {shownLead}
      {struck.text && (
        <del className="text-muted line-through decoration-muted decoration-1">{struck.text}</del>
      )}
      {struckSpace}
      {/* One unbreakable box, so the comma after the word never opens a line. */}
      {(isBoxShown || unwritten) && (
        <span className="relative inline-block whitespace-nowrap">
          {/* Unseen and of no height, they make the box as wide as the wider answer. First,
            so the box's baseline stays on its word's line. */}
          {heldRooms.map((label) => (
            <span key={label} aria-hidden className="invisible block h-0">
              {label}
              {trailRoom ?? trail}
            </span>
          ))}
          {isBoxShown && (
            <button
              ref={button}
              type="button"
              // Which word it is, so the page can hand the focus back to it.
              data-fact={view.key}
              aria-haspopup="listbox"
              aria-expanded={isOpenable}
              aria-controls={isOpenable ? listId : undefined}
              aria-disabled={!isEnabled || undefined}
              // Pressed again, the word rolls its list back into itself, as Escape does.
              onClick={() => {
                // Locked, a press says so and does nothing else, whatever the day allows.
                if (isLocked) return onLockedPress?.();
                if (!isEnabled) return;
                if (isOpen) close(true);
                else setIsOpen(true);
              }}
              onPointerEnter={() => onLight(true)}
              onPointerLeave={() => onLight(false)}
              // Only a keyboard's focus lights the stops: a click hands the focus back to the
              // word after a choice, and the stops should not stay lit for the pointer.
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) onLight(true);
              }}
              onBlur={() => onLight(false)}
              className={cn(
                BUTTON_CLASSES,
                isLocked ? lockedClassesOf(view) : wordClassesOf(view),
                isEnabled && HOVER_CLASSES,
                OPEN_WORD_CLASSES,
              )}
            >
              <FadeIn of={isFaded ? view.label : ""}>
                <Ink text={word} isActive={written.isWriting} />
              </FadeIn>
              <WordTrail
                trail={wordTrail}
                opacity={trailOpacity}
                // The room of the comma it will have opens with the comma, never a beat
                // before its first letter.
                room={isTrailShown && !isPairShown ? (trailRoom ?? wordTrail) : ""}
              />
            </button>
          )}
          {unwritten && (
            <span aria-hidden className="invisible">
              {unwritten}
              {trailRoom ?? trail}
            </span>
          )}
          <AnimatePresence custom={exit}>
            {isOpenable && (
              <WordPicker
                key="picker"
                id={listId}
                word={button}
                options={view.options}
                listLabel={view.listLabel}
                isFocusTaken={!isDrawnOpen}
                onChoose={(value) => {
                  close(true, true);
                  onChoose(value);
                }}
                onClose={close}
              />
            )}
          </AnimatePresence>
        </span>
      )}
      {/* The space before "or" stands outside the pair's box, which would fold it away. */}
      {isPairShown && " "}
      {isPairShown && (
        // Its own unbroken box, so a phone's line may break between the two answers.
        <span className="inline-block whitespace-nowrap">
          <span className="text-muted">{pairJoin}</span>
          {pairWord !== "" && " "}
          {pairWord !== "" && (
            <button
              type="button"
              data-fork-pair={view.key}
              aria-label={`${pair?.label ?? pairWord}, proposed: go to it`}
              onClick={() => pair?.onPoint()}
              className={cn(
                BUTTON_CLASSES,
                "text-swap",
                pair?.isLit && LIT_WORD_CLASSES,
                "underline decoration-swap-drawn decoration-1 underline-offset-4",
              )}
            >
              {pairWord}
            </button>
          )}
          {shownTrail}
        </span>
      )}
    </>
  );
}

interface WordPickerProps {
  id: string;
  /** The word the list hangs from, which keeps its place and its own press. */
  word: RefObject<HTMLElement | null>;
  options: readonly OptionView[];
  /** The list's name for screen readers. */
  listLabel: string;
  /** Drawn open rather than opened, as in a lab cell, it leaves the page's focus where it is. */
  isFocusTaken?: boolean;
  /**
   * What the list hangs from: a word of the headline, its rows at the quote's size starting
   * on the word's first letter; or the masthead's icon at the page's right edge, its rows at
   * the body's size and its right edge on the icon's, so it opens towards the page.
   */
  hang?: keyof typeof HANG_CLASSES;
  onChoose: (value: string) => void;
  /** Closes the picker; Escape and the word's own press give the focus back to the word. */
  onClose: (isFocusReturned: boolean) => void;
}

/** Arrow keys and Home and End move through the options, wrapping round at the ends. */
function nextActive(key: string, active: number, count: number): number | null {
  if (key === "ArrowDown") return (active + 1) % count;
  if (key === "ArrowUp") return (active - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * A word's list of answers, hung under the word: the headline's words open it, and so does
 * the theme's icon. It takes the focus, moves through its options with the arrows, chooses
 * with Enter or a press, and closes on Escape, Tab or a press elsewhere.
 */
export function WordPicker({
  id,
  word,
  options,
  listLabel,
  isFocusTaken = true,
  hang = "word",
  onChoose,
  onClose,
}: WordPickerProps) {
  const current = options.findIndex((option) => option.isCurrent);
  const [active, setActive] = useState(Math.max(0, current));
  // Reopened while it rolls back into the word, the list comes back rather than mounting
  // afresh, so it starts again on the current option. Set while rendering, so the frame it
  // comes back in already points at that option.
  const isPresent = useIsPresent();
  const [wasPresent, setWasPresent] = useState(isPresent);
  if (isPresent !== wasPresent) {
    setWasPresent(isPresent);
    if (isPresent) setActive(Math.max(0, current));
  }
  const panel = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const optionId = (index: number) => `${id}-option-${index}`;
  useHangingList(panel, word, onClose);

  useEffect(() => {
    if (!isPresent || !isFocusTaken) return;
    list.current?.focus();
  }, [isPresent, isFocusTaken]);

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
      return;
    }
    if (event.key === "Tab") {
      onClose(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[active];
      if (option) onChoose(option.value);
      return;
    }
    const next = nextActive(event.key, active, options.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  return (
    <span ref={panel} data-word-list className={cn(LIST_BOX_CLASSES, HANG_CLASSES[hang])}>
      <Fold as="span" spring="snappy" className={LIST_SHEET_CLASSES}>
        <span
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={listLabel}
          aria-activedescendant={optionId(active)}
          onKeyDown={handleKeyDown}
          className={LIST_CLASSES}
        >
          {options.map((option, index) => (
            <OptionRow
              key={option.value}
              id={optionId(index)}
              option={option}
              isActive={index === active}
              onChoose={() => onChoose(option.value)}
            />
          ))}
        </span>
      </Fold>
    </span>
  );
}

interface OptionRowProps {
  id: string;
  option: OptionView;
  isActive: boolean;
  onChoose: () => void;
}

/**
 * An option: its icon where it has one, its words, what it would change, and the check
 * when it is the current answer. The current one is in ink, the others muted until the
 * pointer or the keys reach them. The pointer marks a row with the ground alone and leaves
 * the active option where the keys put it, as the city word's rows do: the ring says where
 * the keyboard is.
 */
function OptionRow({ id, option, isActive, onChoose }: OptionRowProps) {
  const { icon: Icon } = option;
  // Named by its answer alone, and described by what it would do, which is read after it.
  const labelId = `${id}-label`;
  const noteId = `${id}-note`;
  return (
    <span
      id={id}
      role="option"
      aria-selected={option.isCurrent}
      aria-labelledby={labelId}
      aria-describedby={option.consequence ? noteId : undefined}
      onClick={onChoose}
      className={cn(
        LIST_ROW_CLASSES,
        "hover:bg-ground",
        option.isCurrent
          ? "text-ink"
          : cn("text-muted hover:text-ink", isActive && "group-focus-visible/list:text-ink"),
        isActive && ACTIVE_OPTION_CLASSES,
      )}
    >
      {Icon && (
        <span aria-hidden className="mr-2 flex h-lh shrink-0 items-center">
          <Icon size={ICON_SIZES.sm} strokeWidth={ICON_STROKE_WIDTH} />
        </span>
      )}
      <span className="block min-w-0 flex-1">
        <span id={labelId}>{option.label}</span>
        {option.consequence && (
          <span id={noteId} className={ROW_NOTE_CLASSES}>
            {option.consequence}
          </span>
        )}
      </span>
      <CurrentCheck isShown={option.isCurrent} />
    </span>
  );
}
