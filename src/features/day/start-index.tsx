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
 * stands on one foot however its caption wraps, and every caption starts on one line.
 */
const CELL_CLASSES =
  "group row-span-2 grid w-full grid-rows-subgrid rounded-sm text-center focus-ring";

/**
 * The start screen's index under the first impression (`docs/decisions.md`, "The start screen is
 * an index, with a day's first stops under it"): the second way in, of one weight with the
 * question. Each cell is a day Lantern has written: its city's engraving, its city, and its day in
 * a few words, set on the page's paper two across on a phone and four on a laptop
 * (`docs/decisions.md`, "The index's pictures are engravings of a city's everyday thing"). A press
 * opens it where the question was, as a quick start did. A city with no picture keeps its caption
 * on the row's line, with nothing over it.
 */
export function StartIndex({
  starts,
  onChoose,
  listRef,
}: {
  starts: readonly StartOffer[];
  onChoose: (request: DayRequest) => void;
  listRef?: Ref<HTMLUListElement>;
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
        className="grid grid-cols-2 gap-x-6 @abacus:grid-cols-4"
      >
        {starts.map((start) => {
          const gist = requestShortGistOf(start.request);
          return (
            <li key={start.request.city} className="row-span-2 grid grid-rows-subgrid">
              <button
                type="button"
                onClick={() => onChoose(start.request)}
                className={CELL_CLASSES}
              >
                <span className="self-end">
                  <IndexPictureView slug={daySlugOf(start.request)} />
                </span>
                <span className="flex flex-col items-center pt-1 pb-6">
                  {/* A pointer over a cell underlines its city, as the page's links are. */}
                  <span className="type-voice text-quote text-pretty text-ink decoration-line underline-offset-4 group-hover:underline">
                    {start.request.city}
                  </span>
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
        className="self-start rounded-sm type-note text-ink underline decoration-line underline-offset-4 focus-ring hover:decoration-ink"
      >
        {`The whole day, ${excerpt.total} stops`}
      </a>
    </section>
  );
}
