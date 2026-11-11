import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { startExcerptOf } from "./start-excerpt";
import { StartExcerptView, StartIndex } from "./start-index";
import { DRAWN_STARTS, LONG_START, UNDRAWN_START } from "./start-index-examples";
import { startOffersOf } from "./start-offers";
import { writtenPool } from "./written-pool";

/** The written days as the start screen offers them. */
const WRITTEN = startOffersOf(writtenPool());

const COUNTS = {
  drawn: { label: "the eight drawn cities", starts: DRAWN_STARTS },
  undrawn: {
    label: "a city with no picture, and the longest caption, among drawn ones",
    starts: [UNDRAWN_START, DRAWN_STARTS[0], LONG_START, DRAWN_STARTS[7]].flatMap((start) =>
      start === undefined ? [] : [start],
    ),
  },
  one: { label: "one cell, the longest", starts: [LONG_START] },
  written: { label: "the six written days", starts: WRITTEN },
} as const;

interface StartIndexCellProps {
  count: keyof typeof COUNTS;
  hasExcerpt: boolean;
}

const ignore = () => undefined;

/**
 * The start screen's second way in (`docs/decisions.md`, "The start
 * screen is an index, with a day's first stops under it"): the index under its label, at the
 * eight cities it has engravings for, at a city with none among them and the longest caption, at
 * one cell and at the written days, and under it a written day's first stops, still. Each cell's
 * picture is the theme's own: the whole scene by day, the subject alone by night.
 */
export const START_INDEX_MATRIX: LabMatrix = labMatrix<StartIndexCellProps>({
  key: "start-index",
  title: "The start screen's index",
  note: "The written days as an index of engravings under “No city in mind? Start from one of these”, at the eight drawn cities, a city with none, one cell and the written days, and a day's first stops, still, under it",
  base: { count: "drawn", hasExcerpt: true },
  wide: "page",
  axes: [
    {
      name: "lines",
      values: (Object.keys(COUNTS) as (keyof typeof COUNTS)[]).map((count) => ({
        label: COUNTS[count].label,
        props: { count },
      })),
    },
    {
      name: "under the index",
      values: [
        { label: "a day's first stops", props: { hasExcerpt: true } },
        { label: "nothing", props: { hasExcerpt: false } },
      ],
    },
  ],
  // Every count, a day's first stops under each: the default view.
  baseline: [{ rows: 0, columns: 1 }],
  render: ({ count, hasExcerpt }) => {
    const excerpt = hasExcerpt ? startExcerptOf(new Date()) : null;
    return (
      <div>
        <StartIndex starts={COUNTS[count].starts} onChoose={ignore} />
        {excerpt && <StartExcerptView excerpt={excerpt} />}
      </div>
    );
  },
});
