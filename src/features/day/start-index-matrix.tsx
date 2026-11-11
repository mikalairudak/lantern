import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { FirstImpressionProvider } from "./first-impression";
import { startExcerptOf } from "./start-excerpt";
import { StartExcerptView, StartIndex } from "./start-index";
import { startOffersOf } from "./start-offers";
import { writtenPool } from "./written-pool";

interface StartIndexCellProps {
  hasExcerpt: boolean;
}

const ignore = () => undefined;

/**
 * The start screen's second way in under the first impression (`docs/decisions.md`, "The start
 * screen is an index, with a day's first stops under it"): the index of written days under its
 * label, and under it a written day's first stops, still.
 */
export const START_INDEX_MATRIX: LabMatrix = labMatrix<StartIndexCellProps>({
  key: "start-index",
  title: "The start screen's index",
  note: "The written days as an index under “No city in mind? Start from one of these”, and a day's first stops, still, under it",
  base: { hasExcerpt: true },
  wide: "page",
  axes: [
    {
      name: "under the index",
      values: [
        { label: "a day's first stops", props: { hasExcerpt: true } },
        { label: "nothing", props: { hasExcerpt: false } },
      ],
    },
  ],
  render: ({ hasExcerpt }) => {
    const excerpt = hasExcerpt ? startExcerptOf() : null;
    return (
      <FirstImpressionProvider isOn>
        <StartIndex starts={startOffersOf(writtenPool())} onChoose={ignore} />
        {excerpt && <StartExcerptView excerpt={excerpt} />}
      </FirstImpressionProvider>
    );
  },
});
