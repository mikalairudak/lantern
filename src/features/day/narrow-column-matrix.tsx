import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayEnd } from "./day-end-line";
import { DAY_END_EXAMPLES } from "./day-end-examples";
import { FootLine, SOURCES } from "./foot-line";
import { StartIndex } from "./start-index";
import { DRAWN_STARTS } from "./start-index-examples";

/** A written day's end: its summary, what the map found and the question. */
const WRITTEN_DAY_END = DAY_END_EXAMPLES[0]!;

/**
 * A column narrower than a phone gives at the default size (`narrow`, under 14 rem): the key
 * column's width, 10 rem, as large text makes a phone's column, 8 rem at 320 px at 200%.
 */
const NARROW_COLUMN_CLASSES = "max-w-label";

type NarrowPart = "index" | "day-end" | "foot";

interface NarrowColumnCellProps {
  part: NarrowPart;
}

const ignore = () => undefined;

/** Each part as it stands in a narrow column. */
function partOf(part: NarrowPart) {
  switch (part) {
    case "index":
      return <StartIndex starts={DRAWN_STARTS} onChoose={ignore} />;
    case "day-end":
      return (
        <DayEnd
          day={WRITTEN_DAY_END.day}
          shown={WRITTEN_DAY_END.shown}
          checks={WRITTEN_DAY_END.checks}
          onAnswer={ignore}
        />
      );
    case "foot":
      return <FootLine sources={SOURCES} />;
  }
}

/**
 * What a column narrower than any phone gives at the default size sets differently, as the
 * browser's large text makes one (`docs/decisions.md`, "With the visitor's text large, the
 * chart's time column widens to its times, and a headline word wraps"): the start screen's index
 * in one column, its plates at half its width; a day's end with its time over its lines; and the
 * page's foot, a link wider than the line wrapping inside itself, the support address after its
 * "@".
 */
export const NARROW_COLUMN_MATRIX: LabMatrix = labMatrix<NarrowColumnCellProps>({
  key: "narrow-column",
  title: "A narrow column",
  note: "The start screen's index, a day's end and the page's foot in a column narrower than a phone's at the default size, as large text makes one",
  base: { part: "index" },
  wide: "page",
  axes: [
    {
      name: "part",
      values: [
        { label: "the start screen's index: one column", props: { part: "index" } },
        { label: "a day's end: its time over its lines", props: { part: "day-end" } },
        { label: "the page's foot: its links wrap inside themselves", props: { part: "foot" } },
      ],
    },
  ],
  render: ({ part }) => <div className={NARROW_COLUMN_CLASSES}>{partOf(part)}</div>,
});
