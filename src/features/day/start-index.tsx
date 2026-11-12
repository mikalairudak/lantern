"use client";

import { useId, type Ref } from "react";
import { modelPicks } from "@/features/abacus/curve";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { ReadingList } from "./reading-list";
import { daySlugOf } from "@/lib/days/address";
import { IndexPictureView } from "./index-picture";
import { requestShortGistOf, requestSentenceOf } from "./sentence";
import type { StartExcerpt } from "./start-excerpt";
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
 * every word that can be pressed takes, and its engraving comes up to full ink from the 90% every
 * engraving rests at where a pointer can hover. A touch screen draws them all at full ink
 * (`docs/decisions.md`, "What can be pressed takes a rule in ink under a pointer").
 */
const CITY_CLASSES =
  "type-voice text-quote text-pretty text-ink decoration-ink decoration-1 underline-offset-4 pointed-group:underline";
const PICTURE_CLASSES =
  "self-end transition-opacity can-hover:opacity-90 pointed-group:opacity-100";

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

const NO_VERSIONS: ReadonlySet<string> = new Set();

/**
 * Under the ways in, a day Lantern has written, still: its sentence, its line, and its first
 * stops on the plan with the day's light, then a link to the whole day. Nothing plays and nothing
 * in it can be pressed but the link, so it shows what a day is without asking for a press.
 */
export function StartExcerptView({ excerpt }: { excerpt: StartExcerpt }) {
  const heading = useId();
  return (
    <section
      aria-labelledby={heading}
      className="mt-12 flex flex-col gap-4 border-t border-line pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={heading} className="type-note text-muted">
          What a day looks like
        </h2>
        <p className="type-voice text-heading text-pretty text-ink">
          {requestSentenceOf(excerpt.request)}
        </p>
        <p className="type-prose text-small text-pretty text-ink-soft">{excerpt.dek}</p>
      </div>
      {/* Nothing in it can be pressed or focused; it stays in what a screen reader reads. */}
      <div className="pointer-events-none">
        <ReadingList
          stops={excerpt.stops}
          entered={excerpt.stops.length}
          versionsShown={NO_VERSIONS}
          picks={modelPicks(excerpt.stops)}
          daylight={excerpt.daylight}
        />
      </div>
      <a
        href={excerpt.address}
        className="self-start rounded-sm type-note text-ink underline decoration-line decoration-1 underline-offset-4 focus-ring transition-colors pointed:decoration-ink"
      >
        {`The whole day, ${excerpt.total} stops`}
      </a>
    </section>
  );
}
