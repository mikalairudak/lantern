import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { StartIndex, type CellStill } from "./start-index";
import { DRAWN_STARTS, LONG_START, UNDRAWN_START } from "./start-index-examples";

/** A drawn city's start, by its city. */
function startIn(city: string) {
  return DRAWN_STARTS.find((start) => start.request.city === city);
}

const COUNTS = {
  drawn: { label: "the eight cities it offers", starts: DRAWN_STARTS },
  undrawn: {
    label: "a city with no picture, and the longest caption, among drawn ones",
    starts: [UNDRAWN_START, DRAWN_STARTS[0], LONG_START, DRAWN_STARTS[7]].flatMap((start) =>
      start === undefined ? [] : [start],
    ),
  },
  longest: {
    label: "the longest name, wrapping, beside a name of four letters",
    starts: [LONG_START, startIn("Rome")].flatMap((start) => (start === undefined ? [] : [start])),
  },
  one: { label: "one cell, the longest", starts: [LONG_START] },
} as const;

/** A state of the index's light: which cells are held still, and whether its plates wait. */
interface IndexLight {
  label: string;
  stills: Readonly<Record<string, CellStill>>;
  arePicturesHeld: boolean;
}

type LightName =
  "rest" | "pointed" | "neighbours" | "focused" | "touched" | "first-row" | "before-hydration";

/** The index's light, as a pointer, the keyboard or a touch leaves it, held still. */
const LIGHTS: Readonly<Record<LightName, IndexLight>> = {
  rest: { label: "at rest", stills: {}, arePicturesHeld: false },
  pointed: {
    label: "Rome pointed at: lit whole, its name ruled",
    stills: { Rome: "pointed" },
    arePicturesHeld: false,
  },
  neighbours: {
    label: "two neighbours lit: Barcelona and Seoul",
    stills: { Barcelona: "pointed", Seoul: "pointed" },
    arePicturesHeld: false,
  },
  focused: {
    label: "Tokyo focused: lit, ruled, with the ring",
    stills: { Tokyo: "focused" },
    arePicturesHeld: false,
  },
  touched: {
    label: "Rome touched: lit, with no rule",
    stills: { Rome: "touched" },
    arePicturesHeld: false,
  },
  "first-row": {
    label: "the first row lit under the heading: Paris and Madrid",
    stills: { Paris: "pointed", Madrid: "pointed" },
    arePicturesHeld: false,
  },
  "before-hydration": {
    label: "before the page's script runs: the words and the empty boxes",
    stills: {},
    arePicturesHeld: true,
  },
};

interface StartIndexCellProps {
  count: keyof typeof COUNTS;
  light: LightName;
}

const ignore = () => undefined;

/**
 * The start screen's second way in (`docs/decisions.md`, "The start screen is an index, with a
 * day's first stops under it"): the index under its label, at the eight cities it offers, each with
 * its plate, at a city with none among them and the longest caption, at the longest name beside a
 * short one, and at one cell. Each plate draws its whole scene in both themes, its lamps low at
 * rest; one pointed at, focused or touched is lit whole, and a cell pointed at or focused has its
 * city ruled.
 */
export const START_INDEX_MATRIX: LabMatrix = labMatrix<StartIndexCellProps>({
  key: "start-index",
  title: "The start screen's index",
  note: "The written days as an index of plates under “No city in mind? Start from one of these”, at rest and lit by a pointer, the keyboard or a touch",
  base: { count: "drawn", light: "rest" },
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
      name: "light",
      values: (Object.keys(LIGHTS) as LightName[]).map((light) => ({
        label: LIGHTS[light].label,
        props: { light },
      })),
    },
  ],
  render: ({ count, light }) => {
    const { stills, arePicturesHeld } = LIGHTS[light];
    return (
      <StartIndex
        starts={COUNTS[count].starts}
        onChoose={ignore}
        stills={stills}
        arePicturesHeld={arePicturesHeld}
      />
    );
  },
});
