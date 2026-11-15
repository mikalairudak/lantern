"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cn } from "@/components/ui/cn";
import { dayAddressOfId } from "@/lib/days/address";
import { EnergyGlyph } from "./energy-glyph";
import { LINK_CLASSES, TARGET_CLASSES } from "./link-classes";
import { type YourDay } from "./your-days";
import {
  DAYS_SHOWN_AT_FIRST,
  FORGET_YOUR_DAYS,
  YOUR_DAYS_HEADING,
  type YourDaysListProps,
} from "./your-days-list";
import {
  hasNoDayBehind,
  ledgerDateOf,
  ledgerEndingOf,
  ledgerWordsOf,
  type LedgerDateKind,
} from "./your-days-ledger-words";

/** The question that stands in the label's line before the days are forgotten. */
export const FORGET_DAYS_QUESTION = "Forget these days in this browser?";
export const FORGET_DAY_QUESTION = "Forget this day in this browser?";
export const FORGET_ANSWER = "Forget";
export const KEEP_ANSWER = "Keep";

/** How many rows stand before "All your days": three, or one where a screen is short. */
export type RowsAtRest = 1 | typeof DAYS_SHOWN_AT_FIRST;

/** The fold's words once every day shows, by how many stand at rest. */
const NEWEST_SAID: Readonly<Record<RowsAtRest, string>> = {
  1: "Newest day",
  [DAYS_SHOWN_AT_FIRST]: "Newest three",
};

/** A state a lab cell draws still, where a pointer or the keyboard cannot hold it. */
export interface LedgerStill {
  /** The row drawn as pointed at. */
  pointedRow?: number;
  /** The row drawn as the keyboard's focus rings it. */
  focusedRow?: number;
  /** The question to forget standing in the label's line. */
  isForgetAsking?: boolean;
  /** A day being written drawn as under reduced motion: the city in its ink, no light. */
  isMotionReduced?: boolean;
}

export interface YourDaysLedgerProps extends YourDaysListProps {
  /** The energy's scale, its five places, at the head of each row beside the city. */
  hasEnergyWire?: boolean;
  rowsAtRest?: RowsAtRest;
  /** "Forget these days" asks once before it forgets; otherwise one press forgets. */
  isForgetAsked?: boolean;
  /** Which date the date's place says. */
  dateKind?: LedgerDateKind;
  still?: LedgerStill;
}

/**
 * The row: the whole of it one link, bled 8 px into the gutter so the inset ring stands clear
 * of its words. Under the text column's width its parts wrap: the city and the date on one
 * baseline, the words under them. From that width it takes the ledger's three columns from the
 * list, so the dates, the cities and the words each stand in one column down the rows.
 */
const ROW_CLASSES =
  "group/pointed -mx-2 flex items-baseline rounded-sm px-2 py-1.5 focus-ring-inset @measure:col-span-full @measure:grid @measure:grid-cols-subgrid @measure:items-baseline @measure:py-1 @measure:pointer-coarse:py-2";
/**
 * The ring a lab cell draws still, as the keyboard's focus draws it; the row is drawn pointed at
 * too, since the focus shows whatever a pointer shows (`docs/decisions.md`, "What can be pressed
 * takes a rule in ink under a pointer, and the keyboard's focus shows the same").
 */
const FOCUSED_STILL_CLASSES = "outline-2 -outline-offset-2 outline-ink";
/** The row's parts: a wrapping line on a phone, the subgrid's cells from the text column's width. */
const PARTS_CLASSES =
  "flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 @measure:contents";
/**
 * The city, what is pressed, ruled as every pressable word is. It takes the line's room before
 * the date and breaks anywhere if it must, so a 58-letter town never pushes the date down.
 */
const CITY_CELL_CLASSES =
  "order-1 min-w-0 flex-1 type-voice text-quote wrap-anywhere @measure:col-start-2 @measure:row-start-1 @measure:max-w-intro";
const CITY_CLASSES =
  "underline decoration-1 underline-offset-4 transition-colors pointed-group:decoration-2";
const WORDS_CLASSES =
  "order-3 basis-full type-note text-pretty text-muted @measure:col-start-3 @measure:row-start-1";
const DATE_CLASSES =
  "order-2 shrink-0 type-time whitespace-nowrap text-muted @measure:col-start-1 @measure:row-start-1";
/**
 * A folded day's parts on the ledger's columns, as a row's are, but on a line of no height and
 * unseen; it never takes the focus, since it holds no link.
 */
const SIZER_CLASSES =
  "invisible col-span-full grid h-0 grid-cols-subgrid overflow-hidden px-2 -mx-2";
const SMALL_LINK_CLASSES = cn("type-note text-muted", LINK_CLASSES, TARGET_CLASSES);
const ANSWER_CLASSES = cn(LINK_CLASSES, TARGET_CLASSES, "text-ink");

/** Whether a press on a link is a plain one, which the page answers itself. */
function isPlainPress(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The visitor's own days as a ledger, newest first: a line a day, its city, its date and its
 * words, the newest three at rest and the rest behind "All your days", which folds back.
 * "Forget these days" stands at the label's line's end and asks once before it forgets.
 * Nothing at all until there is a day.
 */
export function YourDaysLedger({
  days,
  now,
  onOpen,
  onForget,
  isAllShownAtFirst = false,
  hasEnergyWire = false,
  rowsAtRest = DAYS_SHOWN_AT_FIRST,
  isForgetAsked = true,
  dateKind = "day",
  still = {},
}: YourDaysLedgerProps) {
  const heading = useId();
  const listId = useId();
  const question = useId();
  const [isAllShown, setIsAllShown] = useState(isAllShownAtFirst);
  const [isAsking, setIsAsking] = useState(still.isForgetAsking ?? false);
  const list = useRef<HTMLUListElement>(null);
  const fold = useRef<HTMLButtonElement>(null);
  const forgetButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  // Where the keyboard's focus goes once a press has been drawn, and only after a press.
  const focusOwed = useRef<"shown" | "fold" | "keep" | "forget" | null>(null);

  useEffect(() => {
    const owed = focusOwed.current;
    focusOwed.current = null;
    if (owed === "shown") list.current?.querySelectorAll("a")[rowsAtRest]?.focus();
    // Folded, the button stays under the focus and comes back into sight if the fold took it off.
    if (owed === "fold") fold.current?.scrollIntoView({ block: "nearest" });
    if (owed === "keep") keepButton.current?.focus();
    if (owed === "forget") forgetButton.current?.focus();
  }, [isAllShown, isAsking, rowsAtRest]);

  if (days.length === 0) return null;
  const today = now ?? new Date();
  const shown = isAllShown ? days : days.slice(0, rowsAtRest);

  const toggleFold = () => {
    focusOwed.current = isAllShown ? "fold" : "shown";
    setIsAllShown(!isAllShown);
  };
  const forget = () => {
    setIsAsking(false);
    onForget();
  };
  const ask = () => {
    if (!isForgetAsked) {
      onForget();
      return;
    }
    focusOwed.current = "keep";
    setIsAsking(true);
  };
  const keep = () => {
    focusOwed.current = "forget";
    setIsAsking(false);
  };
  const keepOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") keep();
  };

  return (
    <div className="@container mt-10">
      <div className="flex items-baseline justify-between gap-x-4 pb-2">
        {/* Kept in the page while the question stands, so the list keeps its name. */}
        <h2 id={heading} className={cn("type-note text-muted", isAsking && "sr-only")}>
          {YOUR_DAYS_HEADING}
        </h2>
        {isAsking ? (
          // One group named by its question, so the answer the focus lands on is heard with it.
          <div
            role="group"
            aria-labelledby={question}
            onKeyDown={keepOnEscape}
            className="flex flex-wrap items-baseline gap-x-2 type-note text-muted"
          >
            <span id={question}>
              {days.length === 1 ? FORGET_DAY_QUESTION : FORGET_DAYS_QUESTION}
            </span>
            <span className="whitespace-nowrap">
              <button type="button" onClick={forget} className={ANSWER_CLASSES}>
                {FORGET_ANSWER}
              </button>
              <span aria-hidden className="mx-2">
                ·
              </span>
              <button type="button" ref={keepButton} onClick={keep} className={ANSWER_CLASSES}>
                {KEEP_ANSWER}
              </button>
            </span>
          </div>
        ) : (
          <button type="button" ref={forgetButton} onClick={ask} className={SMALL_LINK_CLASSES}>
            {FORGET_YOUR_DAYS}
          </button>
        )}
      </div>
      <ul
        ref={list}
        id={listId}
        aria-labelledby={heading}
        className="@measure:grid @measure:max-w-abacus @measure:grid-cols-ledger @measure:gap-x-6"
      >
        {shown.map((day, at) => (
          <li key={day.id} className="@measure:contents">
            <LedgerRow
              day={day}
              now={today}
              dateKind={dateKind}
              hasEnergyWire={hasEnergyWire}
              isPointed={still.pointedRow === at}
              isFocused={still.focusedRow === at}
              isMotionReduced={still.isMotionReduced ?? false}
              onOpen={onOpen}
            />
          </li>
        ))}
        {days.slice(shown.length).map((day) => (
          <LedgerSizer
            key={day.id}
            day={day}
            now={today}
            dateKind={dateKind}
            hasEnergyWire={hasEnergyWire}
          />
        ))}
      </ul>
      {days.length > rowsAtRest && (
        <p className="pt-1">
          <button
            type="button"
            ref={fold}
            aria-expanded={isAllShown}
            aria-controls={listId}
            onClick={toggleFold}
            className={SMALL_LINK_CLASSES}
          >
            {isAllShown ? NEWEST_SAID[rowsAtRest] : `All your days · ${days.length}`}
          </button>
        </p>
      )}
    </div>
  );
}

interface LedgerRowProps {
  day: YourDay;
  now: Date;
  dateKind: LedgerDateKind;
  hasEnergyWire: boolean;
  isPointed: boolean;
  isFocused: boolean;
  isMotionReduced: boolean;
  onOpen: (day: YourDay) => void;
}

/**
 * One day: a plain link to its own address, so a press with a modifier, a middle press and the
 * browser's own menu get the address, while a plain press opens it as the page does, a day
 * still in memory without a reload. In the page's source the city, the words and then the date,
 * each ended by a stop heard and not seen, so the link is named as a sentence.
 */
function LedgerRow({
  day,
  now,
  dateKind,
  hasEnergyWire,
  isPointed,
  isFocused,
  isMotionReduced,
  onOpen,
}: LedgerRowProps) {
  const { energy, words } = ledgerWordsOf(day);
  const ending = ledgerEndingOf(day, now);
  const isLit = day.ending === "writing" && !isMotionReduced;
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainPress(event)) return;
    event.preventDefault();
    onOpen(day);
  };
  const wire = <EnergyGlyph level={day.request.energy} isDayLevel />;
  return (
    <a
      href={dayAddressOfId(day.id)}
      onClick={open}
      data-pointed={isPointed || isFocused || undefined}
      className={cn(ROW_CLASSES, isFocused && FOCUSED_STILL_CLASSES)}
    >
      {hasEnergyWire && (
        // On a phone the wire heads the row and the words stand clear of it; from the text
        // column's width it stands in the city's column, before the city.
        <span aria-hidden className="mr-3 shrink-0 type-voice text-quote @measure:hidden">
          {wire}
        </span>
      )}
      <span className={PARTS_CLASSES}>
        <span className={CITY_CELL_CLASSES}>
          {hasEnergyWire && (
            <span aria-hidden className="mr-3 hidden @measure:inline">
              {wire}
            </span>
          )}
          {/* The rule on the outer span, the light on the inner, whose text it passes through:
              on one span the light's clear fill takes the rule with it. */}
          <span className={cn(CITY_CLASSES, hasNoDayBehind(day, now) ? "text-muted" : "text-ink")}>
            <span className={cn(isLit && "word-lit")}>{day.request.city}</span>
          </span>
          <span className="sr-only">.</span>
        </span>{" "}
        <span className={WORDS_CLASSES}>
          <span className="text-energy">{energy}</span>{" "}
          {words.map((word, index) => (
            <Fragment key={word}>
              {index > 0 && " "}
              <span className="whitespace-nowrap">
                {word}
                {index < words.length - 1 && ","}
              </span>
            </Fragment>
          ))}
          {ending && (
            <>
              {" "}
              <span className="whitespace-nowrap">· {ending}</span>
            </>
          )}
          <span className="sr-only">.</span>
        </span>{" "}
        <span className={DATE_CLASSES}>{ledgerDateOf(day, now, dateKind)}</span>
      </span>
    </a>
  );
}

interface LedgerSizerProps {
  day: YourDay;
  now: Date;
  dateKind: LedgerDateKind;
  hasEnergyWire: boolean;
}

/**
 * A folded day's date and city, set in the ledger's grid for its columns' widths alone: unseen,
 * no taller than nothing, out of the reading and the tab order. The date's and the city's columns
 * are as wide as the widest of every day the visitor keeps, so the rows on screen stay where they
 * stand as the fold opens and closes. Under the text column's width there is no grid to size.
 */
function LedgerSizer({ day, now, dateKind, hasEnergyWire }: LedgerSizerProps) {
  return (
    <li aria-hidden className="hidden @measure:contents">
      <span className={SIZER_CLASSES}>
        <span className="col-start-1 type-time whitespace-nowrap">
          {ledgerDateOf(day, now, dateKind)}
        </span>
        <span className="col-start-2 max-w-intro type-voice text-quote wrap-anywhere">
          {hasEnergyWire && (
            <span className="mr-3">
              <EnergyGlyph level={day.request.energy} isDayLevel />
            </span>
          )}
          {day.request.city}
        </span>
      </span>
    </li>
  );
}
