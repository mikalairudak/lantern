import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { startExcerptOf } from "./start-excerpt";
import { StartExcerptView, StartIndex } from "./start-index";
import { DRAWN_STARTS, LONG_START, UNDRAWN_START } from "./start-index-examples";

const COUNTS = {
  drawn: { label: "the eight cities it offers", starts: DRAWN_STARTS },
  undrawn: {
    label: "a city with no picture, and the longest caption, among drawn ones",
    starts: [UNDRAWN_START, DRAWN_STARTS[0], LONG_START, DRAWN_STARTS[7]].flatMap((start) =>
      start === undefined ? [] : [start],
    ),
  },
  one: { label: "one cell, the longest", starts: [LONG_START] },
} as const;

interface StartIndexCellProps {
  count: keyof typeof COUNTS;
  hasExcerpt: boolean;
  /** Whether a cell is drawn pointed at, as a pointer or the keyboard leaves it: the second. */
  isPointed: boolean;
}

const ignore = () => undefined;

/**
 * The start screen's second way in (`docs/decisions.md`, "The start
 * screen is an index, with a day's first stops under it"): the index under its label, at the
 * eight cities it offers, each with its engraving, at a city with none among them and the longest
 * caption, and at one cell, and under it a written day's first stops, still. Each cell's
 * picture is the theme's own: the whole scene by day, the subject alone by night. A cell pointed
 * at stands forward, its city ruled and the other pictures stepped back.
 */
export const START_INDEX_MATRIX: LabMatrix = labMatrix<StartIndexCellProps>({
  key: "start-index",
  title: "The start screen's index",
  note: "The written days as an index of engravings under “No city in mind? Start from one of these”, at the eight cities it offers, a city with none and one cell, and a day's first stops, still, under it",
  base: { count: "drawn", hasExcerpt: true, isPointed: false },
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
    {
      name: "pointer",
      values: [
        { label: "at rest", props: { isPointed: false } },
        { label: "a cell pointed at", props: { isPointed: true } },
      ],
    },
  ],
  // Every count, a day's first stops under each: the default view; and every count pointed at.
  baseline: [
    { rows: 0, columns: 1 },
    { rows: 0, columns: 2 },
  ],
  render: ({ count, hasExcerpt, isPointed }) => {
    const excerpt = hasExcerpt ? startExcerptOf(new Date()) : null;
    const { starts } = COUNTS[count];
    return (
      <div>
        <StartIndex
          starts={starts}
          onChoose={ignore}
          pointedCity={isPointed ? (starts[1] ?? starts[0])?.request.city : null}
        />
        {excerpt && <StartExcerptView excerpt={excerpt} />}
      </div>
    );
  },
});
