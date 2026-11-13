import { MotionConfig } from "motion/react";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { IndexPlate } from "./index-picture";
import { PLATE_EXAMPLES, withMissingFilesOf, type PlateExample } from "./index-picture-examples";
import type { PlateStill } from "./plate-light";

/** A plate's state: its light, held where a lab cell holds it, and its files and motion. */
interface PlateCellState {
  label: string;
  isLit?: boolean;
  still?: PlateStill;
  files?: "held" | "scene" | "failed";
  isReduced?: boolean;
}

type PlateState =
  | "before"
  | "scene"
  | "failed"
  | "rest"
  | "coming"
  | "lit"
  | "jump"
  | "leaving"
  | "reduced-rest"
  | "reduced-lit";

/** A plate's states, as its files arrive, as it rests, as its light comes on and leaves. */
const STATES: Readonly<Record<PlateState, PlateCellState>> = {
  before: { label: "before its files: the box, empty", files: "held" },
  scene: { label: "the scene in, the bounds not: the box, still empty", files: "scene" },
  failed: { label: "a file failed: the box, empty for good", files: "failed" },
  rest: { label: "at rest: the lines, each lamp's pool and, by night, the tone" },
  coming: {
    label: "coming on: each circle at half its lit reach",
    still: { reach: "lit", share: 0.5 },
  },
  lit: { label: "lit whole, settled", isLit: true },
  jump: {
    label: "leaving, at the jump: each circle at its covering reach, whole",
    still: { reach: "covering", share: 1 },
  },
  leaving: {
    label: "leaving, part-way: each circle at half its covering reach",
    still: { reach: "covering", share: 0.5 },
  },
  "reduced-rest": { label: "reduced motion, at rest", isReduced: true },
  "reduced-lit": { label: "reduced motion, lit whole at once", isLit: true, isReduced: true },
};

interface PlateCellProps {
  state: PlateState;
  plate: PlateExample;
}

/**
 * A city's plate (`index-picture.tsx`) in a cell of the index's width, two across on a phone and
 * four on a laptop, at each state it passes through, its light held part-way where it moves, and on each plate at an edge of what a
 * plate holds: one lamp near the foot or a side, the tallest scenes, two lamps near or far, the
 * widest scene and none.
 */
export const INDEX_PICTURE_MATRIX: LabMatrix = labMatrix<PlateCellProps>({
  key: "index-picture",
  title: "A city's plate",
  note: "Each city's engraving as a plate, its lamps low at rest, at each state and on the plates at its edges",
  base: { state: "rest", plate: "new-york" },
  wide: "page",
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
    const { isLit = false, still, files, isReduced = false } = STATES[state];
    return (
      <MotionConfig reducedMotion={isReduced ? "always" : "user"}>
        <div className="@container">
          <div className="-mx-3 grid grid-cols-2 @abacus:grid-cols-4">
            <div className="px-3">
              <IndexPlate
                picture={files === "failed" ? withMissingFilesOf(picture) : picture}
                isLit={isLit}
                still={still}
                files={files === "held" ? "none" : files === "scene" ? "scene" : "all"}
              />
            </div>
          </div>
        </div>
      </MotionConfig>
    );
  },
});
