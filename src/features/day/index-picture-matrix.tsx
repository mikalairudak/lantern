import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { IndexPlate } from "./index-picture";
import { PLATE_EXAMPLES, withMissingFilesOf, type PlateExample } from "./index-picture-examples";

/** A plate's states, as its files arrive and as it rests. */
const STATES = {
  before: { label: "before its files: the box, empty" },
  failed: { label: "a file failed: the box, empty for good" },
  rest: { label: "at rest: the lines, each lamp's pool and, by night, the tone" },
} as const;

type PlateState = keyof typeof STATES;

interface PlateCellProps {
  state: PlateState;
  plate: PlateExample;
}

/**
 * A city's plate (`index-picture.tsx`) in a cell of the index's width, two across on a phone and
 * four on a laptop, at each state it passes through and on each plate at an edge of what a
 * plate holds: one lamp near the foot or a side, the tallest scenes, two lamps near or far, the
 * widest scene and none.
 */
export const INDEX_PICTURE_MATRIX: LabMatrix = labMatrix<PlateCellProps>({
  key: "index-picture",
  title: "A city's plate",
  note: "Each city's engraving as a plate, its lamps low at rest, at each state and on the plates at its edges",
  base: { state: "rest", plate: "new-york" },
  wide: "page",
  baseline: [],
  axes: [
    {
      name: "state",
      values: (Object.keys(STATES) as PlateState[]).map((state) => ({
        label: STATES[state].label,
        props: { state },
      })),
    },
    {
      name: "plate",
      values: (Object.keys(PLATE_EXAMPLES) as PlateExample[]).map((plate) => ({
        label: PLATE_EXAMPLES[plate].label,
        props: { plate },
      })),
    },
  ],
  render: ({ state, plate }) => {
    const { picture } = PLATE_EXAMPLES[plate];
    return (
      <div className="@container">
        <div className="-mx-3 grid grid-cols-2 @abacus:grid-cols-4">
          <div className="px-3">
            <IndexPlate
              picture={state === "failed" ? withMissingFilesOf(picture) : picture}
              shouldAskFiles={state !== "before"}
            />
          </div>
        </div>
      </div>
    );
  },
});
