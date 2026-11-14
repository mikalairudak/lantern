"use client";

import { useEffect, useId, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/components/ui/cn";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { daySlugOf } from "@/lib/days/address";
import { IndexPictureView } from "./index-picture";
import { requestShortGistOf } from "./sentence";
import type { StartOffer } from "./start-offers";

/** Over the index: it speaks to the visitor the index is for, the one with no city in mind. */
export const INDEX_LABEL = "No city in mind? Start from one of these";

/**
 * A cell spans its row's two tracks, the pictures' and the captions', so every picture of a row
 * stands on one foot however its caption wraps, and every caption starts on one line. The space
 * between columns is the cells' own, half on each side, so a pointer crossing a row is always
 * over a cell and no picture flickers between them.
 */
const CELL_CLASSES =
  "group/pointed row-span-2 grid w-full grid-rows-subgrid rounded-sm px-3 text-center focus-ring";

/**
 * A cell pointed at, by a pointer or the keyboard, stands forward: its city takes the ink rule
 * every word that can be pressed takes (`docs/decisions.md`, "What can be pressed takes a rule in
 * ink under a pointer"), and its plate is lit whole (`index-picture.tsx`).
 */
const CITY_CLASSES =
  "type-voice text-quote text-pretty text-ink decoration-ink decoration-1 underline-offset-4 pointed-group:underline";
const PICTURE_CLASSES = "self-end";
/** The keyboard's ring, drawn still on a cell a lab shows focused: `focus-ring`'s own. */
const STILL_RING_CLASSES = "outline-2 outline-offset-2 outline-ink";

/** A cell drawn still, as a lab cell shows it: pointed at, focused by the keyboard, or touched. */
export type CellStill = "pointed" | "focused" | "touched";

/** What marks an index's cell, so a touch elsewhere is told from a touch on a cell. */
const CELL_ATTRIBUTE = "data-index-cell";

/** Whether the keyboard brought the focus, as `:focus-visible` says. */
function isFocusVisible(element: Element): boolean {
  return element.matches(":focus-visible");
}

/**
 * The start screen's index (`docs/decisions.md`, "The start screen is
 * an index, with a day's first stops under it"): the second way in, of one weight with the
 * question. Each cell is a day Lantern has written: its city's engraving, its city, and its day in
 * a few words, set on the page's paper two across on a phone and four on a laptop
 * (`docs/decisions.md`, "The index's pictures are engravings of a city's everyday thing"). A press
 * opens it where the question was. A city with no picture keeps its caption
 * on the row's line, with nothing over it.
 *
 * A cell's plate is lit while a pointer is over it, while the keyboard's focus is on it, and from a
 * touch on it until a touch elsewhere: a finger cannot hover, so the touch is the pointer, and one
 * plate is lit by touch at a time. A touch never stands for a pointer, so nothing stays lit as if
 * hovered after a tap. A pointer and the keyboard may light two plates at once. Each change is
 * drawn in the frame it happens in: a pointer's events come just before a frame is painted, and a
 * render left for later lands a frame after it, so a plate left would stay whole for a frame and
 * one pointed at again would go on leaving for one.
 */
export function StartIndex({
  starts,
  onChoose,
  listRef,
  stills = {},
  arePicturesHeld = false,
  picturesFor = {},
}: {
  starts: readonly StartOffer[];
  onChoose: (request: DayRequest) => void;
  listRef?: Ref<HTMLUListElement>;
  /** Cells drawn still, by city, as a lab cell shows them. */
  stills?: Readonly<Record<string, CellStill>>;
  /** Whether the plates hold back their files, as a page does before its script runs. */
  arePicturesHeld?: boolean;
  /** A picture drawn for a city the site draws none for, by its slug, as a lab cell shows one. */
  picturesFor?: Readonly<Record<string, string>>;
}) {
  const label = useId();
  const [pointed, setPointed] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [touched, setTouched] = useState<string | null>(null);

  useEffect(() => {
    if (touched === null) return undefined;
    const putOut = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      if (event.target instanceof Element && event.target.closest(`[${CELL_ATTRIBUTE}]`) !== null) {
        return;
      }
      flushSync(() => setTouched(null));
    };
    document.addEventListener("pointerdown", putOut);
    return () => document.removeEventListener("pointerdown", putOut);
  }, [touched]);

  return (
    <section aria-labelledby={label} className="@container mt-10 flex flex-col">
      <h2 id={label} className="pb-3 type-note text-muted">
        {INDEX_LABEL}
      </h2>
      <ul
        ref={listRef}
        aria-labelledby={label}
        className="-mx-3 grid grid-cols-2 @abacus:grid-cols-4"
      >
        {starts.map((start) => {
          const gist = requestShortGistOf(start.request);
          const { city } = start.request;
          const still = stills[city];
          const isLit = still !== undefined || [pointed, focused, touched].includes(city);
          const leave = (left: string | null) => (left === city ? null : left);
          return (
            <li key={city} className="row-span-2 grid grid-rows-subgrid">
              <button
                type="button"
                onClick={() => onChoose(start.request)}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") flushSync(() => setPointed(city));
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") flushSync(() => setPointed(leave));
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === "touch") flushSync(() => setTouched(city));
                }}
                onFocus={(event) => {
                  if (isFocusVisible(event.currentTarget)) flushSync(() => setFocused(city));
                }}
                onBlur={() => flushSync(() => setFocused(leave))}
                {...{ [CELL_ATTRIBUTE]: "" }}
                data-pointed={still === "pointed" || still === "focused" || undefined}
                className={cn(CELL_CLASSES, still === "focused" && STILL_RING_CLASSES)}
              >
                <span className={PICTURE_CLASSES}>
                  <IndexPictureView
                    slug={picturesFor[city] ?? daySlugOf(start.request)}
                    isLit={isLit}
                    files={arePicturesHeld ? "none" : "all"}
                  />
                </span>
                <span className="flex flex-col items-center pt-1 pb-6">
                  <span className={CITY_CLASSES}>{start.request.city}</span>
                  {/* A space between lines, so the cell's name reads as words; a column shows none. */}{" "}
                  <span className="type-note text-muted">{gist.day}</span>{" "}
                  {gist.word !== null && <span className="type-note text-muted">{gist.word}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
