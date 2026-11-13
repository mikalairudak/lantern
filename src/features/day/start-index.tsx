"use client";

import { useId, type Ref } from "react";
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
 * ink under a pointer"). Its plate is drawn whole at every rest, so its tone and lamps are never
 * greyed.
 */
const CITY_CLASSES =
  "type-voice text-quote text-pretty text-ink decoration-ink decoration-1 underline-offset-4 pointed-group:underline";
const PICTURE_CLASSES = "self-end";

/**
 * The start screen's index (`docs/decisions.md`, "The start screen is
 * an index, with a day's first stops under it"): the second way in, of one weight with the
 * question. Each cell is a day Lantern has written: its city's engraving, its city, and its day in
 * a few words, set on the page's paper two across on a phone and four on a laptop
 * (`docs/decisions.md`, "The index's pictures are engravings of a city's everyday thing"). A press
 * opens it where the question was. A city with no picture keeps its caption
 * on the row's line, with nothing over it.
 */
export function StartIndex({
  starts,
  onChoose,
  listRef,
  pointedCity = null,
}: {
  starts: readonly StartOffer[];
  onChoose: (request: DayRequest) => void;
  listRef?: Ref<HTMLUListElement>;
  /** A cell drawn as pointed at, still, as a lab cell shows it. */
  pointedCity?: string | null;
}) {
  const label = useId();
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
          return (
            <li key={start.request.city} className="row-span-2 grid grid-rows-subgrid">
              <button
                type="button"
                onClick={() => onChoose(start.request)}
                data-pointed={start.request.city === pointedCity || undefined}
                className={CELL_CLASSES}
              >
                <span className={PICTURE_CLASSES}>
                  <IndexPictureView slug={daySlugOf(start.request)} />
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
