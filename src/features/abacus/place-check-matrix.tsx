import { labMatrix } from "@/lib/lab-matrix";
import { PlaceCheckCell, type PlaceCheckCellProps } from "./place-check-cell";
import { STOP_ROW_EXAMPLES } from "./stop-row-examples";

/** The stop row's examples a check reads differently on, by their labels. */
const CHECK_EXAMPLE_LABELS = [
  "a calm place, at its best light",
  "a lively place",
  "the longest name",
  "a long neighbourhood",
  "a lunch named by its food and where",
];

function exampleAt(label: string): number {
  const at = STOP_ROW_EXAMPLES.findIndex((example) => example.label === label);
  if (at === -1) throw new Error(`The stop row has no example "${label}"`);
  return at;
}

const CHECK_EXAMPLES = CHECK_EXAMPLE_LABELS.map(exampleAt);
/** The lunch again, its sheet open: a place to eat around's map row in every check. */
const OPEN_LUNCH = exampleAt("a lunch named by its food and where");

/**
 * A stop's place as the search finds it, while the day is written and after: being looked
 * up, confirmed by its name at a spot or by places of its kind around its point, not
 * confirmed, its lookup failed, or never checked, as a day written by hand. Only a confirmed
 * place carries the mark, after where it is; an open one's sheet says how to get there on a
 * map and how far the map vouches for it, whatever its check (`map-action.ts`): its "open"
 * row in each check, and the open lunch's, a place to eat around led to only once its point
 * is vouched for (`docs/grounding.md`, "What the visitor sees").
 */
export const PLACE_CHECK_MATRIX = labMatrix<PlaceCheckCellProps>({
  key: "place-check",
  title: "Place check",
  note: "A place being looked up, confirmed, or not, in its row and its sheet, at each density",
  base: {
    example: CHECK_EXAMPLES[0]!,
    state: "complete",
    density: null,
    check: "confirmed by name",
  },
  axes: [
    {
      name: "check",
      values: [
        { label: "never checked, a day from its file", props: { check: null } },
        { label: "being looked up", props: { check: "checking" } },
        { label: "confirmed by its name", props: { check: "confirmed by name" } },
        {
          label: "confirmed by places of its kind around it",
          props: { check: "confirmed by area" },
        },
        { label: "not confirmed", props: { check: "unconfirmed" } },
        { label: "its lookup failed", props: { check: "unchecked" } },
      ],
    },
    {
      name: "row",
      values: [
        { label: "complete", props: { state: "complete" } },
        { label: "open", props: { state: "open" } },
        // Its words wait unseen for its bead, so no mark comes with them; weighed, the pen
        // writes its name first, and the mark comes once the row rests and says where it is.
        {
          label: "its words streamed, waiting unseen for its light",
          props: { state: "unweighed" },
        },
        { label: "weighed, its words coming in with its bead", props: { state: "weighing" } },
        { label: "another version swapped in", props: { state: "swapped" } },
      ],
    },
    {
      name: "data",
      values: [
        ...CHECK_EXAMPLES.map((example) => ({
          label: STOP_ROW_EXAMPLES[example]?.label ?? `example ${example}`,
          props: { example },
        })),
        // Laid over the row's moment, as the later axis is: the second view's lunch, open.
        { label: "the lunch, its sheet open", props: { example: OPEN_LUNCH, state: "open" } },
      ],
    },
    {
      name: "density",
      values: [
        { label: "as its energy says", props: { density: null } },
        { label: "open", props: { density: "open" } },
        { label: "standard", props: { density: "standard" } },
        { label: "folded", props: { density: "folded" } },
      ],
    },
  ],
  // Each check against each moment of the row, and each check against each example: a check
  // by the places around is a meal's, so only the second view shoots its mark and its sheet.
  baseline: [
    { rows: 0, columns: 1 },
    { rows: 0, columns: 2 },
  ],
  render: (props) => <PlaceCheckCell {...props} />,
});
