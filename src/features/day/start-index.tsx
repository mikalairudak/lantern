"use client";

import { useId, type Ref } from "react";
import { modelPicks } from "@/features/abacus/curve";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { ReadingList } from "./reading-list";
import { requestGistOf, requestSentenceOf } from "./sentence";
import type { StartExcerpt } from "./start-excerpt";
import type { StartOffer } from "./start-offers";

/** Over the index: it speaks to the visitor the index is for, the one with no city in mind. */
export const INDEX_LABEL = "No city in mind? Start from one of these";

const ROW_CLASSES = "group flex w-full items-center gap-3 rounded-sm py-3 text-left focus-ring";

/**
 * The start screen's index under the first impression (`docs/decisions.md`, "The start screen is
 * an index, with a day's first stops under it"): the second way in, of one weight with the
 * question. Each line is a day Lantern has written: a small picture, its city, and its country
 * and its day in a few words; a press opens it where the question was, as a quick start did.
 * The pictures stand in for the ones to be made, in one style, and say nothing a reader needs.
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
      <h2 id={label} className="pb-2 type-note text-muted">
        {INDEX_LABEL}
      </h2>
      <ul
        ref={listRef}
        aria-labelledby={label}
        className="flex flex-col border-t border-line @abacus:grid @abacus:grid-cols-2 @abacus:gap-x-8"
      >
        {starts.map((start) => (
          <li key={start.request.city} className="border-b border-line">
            <button type="button" onClick={() => onChoose(start.request)} className={ROW_CLASSES}>
              <span
                aria-hidden
                className="size-14 shrink-0 rounded-md border border-line bg-surface"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                {/* A pointer over a line underlines its city, as the page's links are. */}
                <span className="type-voice text-quote text-pretty text-ink decoration-line underline-offset-4 group-hover:underline">
                  {start.request.city}
                </span>
                <span className="type-note text-muted">
                  {start.country} · {requestGistOf(start.request)}
                </span>
              </span>
            </button>
          </li>
        ))}
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
