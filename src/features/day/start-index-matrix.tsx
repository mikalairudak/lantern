import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { ELCHE_REQUEST } from "@/lib/fixtures/replan/elche-dinner";
import { FirstImpressionProvider } from "./first-impression";
import { startExcerptOf } from "./start-excerpt";
import { StartExcerptView, StartIndex } from "./start-index";
import { startOffersOf, type StartOffer } from "./start-offers";
import { writtenPool } from "./written-pool";

/** The written days as the start screen offers them. */
const WRITTEN = startOffersOf(writtenPool());

/**
 * A line at the index's extremes: production's Elche day, its city named "Elx / Elche" and its
 * day in many words, so the name and the line under it wrap beside the picture at a phone's width.
 */
const LONG: StartOffer = {
  country: "Spain, the Valencian Community",
  request: ELCHE_REQUEST,
  energies: ["calm", "balanced", "balanced", "lively", "calm"],
};

const COUNTS = {
  one: { label: "one line, the longest", starts: [LONG] },
  written: { label: "the six written days", starts: WRITTEN },
  odd: { label: "seven lines, an odd count in two columns", starts: [...WRITTEN, LONG] },
} as const;

interface StartIndexCellProps {
  count: keyof typeof COUNTS;
  hasExcerpt: boolean;
}

const ignore = () => undefined;

/**
 * The start screen's second way in under the first impression (`docs/decisions.md`, "The start
 * screen is an index, with a day's first stops under it"): the index under its label, at one
 * line, at the written days and at an odd count, and under it a written day's first stops, still.
 */
export const START_INDEX_MATRIX: LabMatrix = labMatrix<StartIndexCellProps>({
  key: "start-index",
  title: "The start screen's index",
  note: "The written days as an index under “No city in mind? Start from one of these”, at one line, six and seven, and a day's first stops, still, under it",
  base: { count: "written", hasExcerpt: true },
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
    const excerpt = hasExcerpt ? startExcerptOf() : null;
    return (
      <FirstImpressionProvider isOn>
        <div data-first-impression="">
          <StartIndex starts={COUNTS[count].starts} onChoose={ignore} />
          {excerpt && <StartExcerptView excerpt={excerpt} />}
        </div>
      </FirstImpressionProvider>
    );
  },
});
