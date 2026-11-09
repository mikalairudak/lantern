import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { FootLine, SOURCES, type Source } from "./foot-line";

interface FootLineCellProps {
  sources: readonly Source[];
}

/**
 * The page's foot on each kind of page (`docs/decisions.md`, "Places are checked through Geoapify,
 * not Google Places"): under a day, its sources on the left and Lantern's links on the right,
 * stacked on a phone; on a page that shows no place, Lantern's links alone, still on the right.
 */
export const FOOT_LINE_MATRIX: LabMatrix = labMatrix<FootLineCellProps>({
  key: "foot-line",
  title: "The page's foot",
  note: "Lantern's links on every page, a day's sources beside them, apart from the day",
  base: { sources: SOURCES },
  wide: "page",
  axes: [
    {
      name: "page",
      values: [
        { label: "a day, its sources credited", props: { sources: SOURCES } },
        { label: "a page that shows no place", props: { sources: [] } },
      ],
    },
  ],
  render: (props) => <FootLine {...props} />,
});
