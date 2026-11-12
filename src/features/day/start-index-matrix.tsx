import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { StartIndex } from "./start-index";
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
  /** Whether a cell is drawn pointed at, as a pointer or the keyboard leaves it: the second. */
  isPointed: boolean;
}

const ignore = () => undefined;

/**
 * The start screen's second way in (`docs/decisions.md`, "The start screen is an index, with a
 * day's first stops under it"): the index under its label, at the eight cities it offers, each with
 * its engraving, at a city with none among them and the longest caption, and at one cell. Each
 * cell's picture is the theme's own: the whole scene by day, the subject alone by night. A cell
 * pointed at stands forward, its city ruled and its picture up to full ink from the 90% the others
 * rest at.
 */
export const START_INDEX_MATRIX: LabMatrix = labMatrix<StartIndexCellProps>({
  key: "start-index",
  title: "The start screen's index",
  note: "The written days as an index of engravings under “No city in mind? Start from one of these”, at the eight cities it offers, a city with none and one cell",
  base: { count: "drawn", isPointed: false },
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
      name: "pointer",
      values: [
        { label: "at rest", props: { isPointed: false } },
        { label: "a cell pointed at", props: { isPointed: true } },
      ],
    },
  ],
  render: ({ count, isPointed }) => {
    const { starts } = COUNTS[count];
    return (
      <StartIndex
        starts={starts}
        onChoose={ignore}
        pointedCity={isPointed ? (starts[1] ?? starts[0])?.request.city : null}
      />
    );
  },
});
