import { labMatrix } from "@/lib/lab-matrix";
import { ForkLine, ForkRow } from "./fork-row";
import {
  FORK_EXAMPLES,
  FORK_MOMENTS,
  forkViewAt,
  type ForkExample,
  type ForkMoment,
} from "./fork-row-examples";
import { chartScale } from "./geometry";
import { DEFAULT_DRAWING } from "./rows";

/** A fork row at one moment of one example, as a still sets it. */
interface ForkRowCellProps {
  example: ForkExample;
  moment: ForkMoment;
}

/** A phone's chart at 390 px: its column 358 px wide, the day's hours as asked. */
const PHONE_CHART = chartScale(358, 96, 7 * 60, 21 * 60);
/** The abacus column on a laptop, 48 rems at the default size. */
const LAPTOP_CHART = chartScale(768, 96, 7 * 60, 21 * 60);

const ignore = () => undefined;

/**
 * One fork row as the chart draws it over its part: on a phone its line under its answers, in
 * the room it holds; on a laptop its answers alone, the line in the margin beside it.
 */
function ForkRowCell({ example, moment, isPhone }: ForkRowCellProps & { isPhone: boolean }) {
  const scale = isPhone ? PHONE_CHART : LAPTOP_CHART;
  const { row } = DEFAULT_DRAWING;
  const view = forkViewAt(example, moment);
  const isLineInMargin = !isPhone && (!view.isChosen || view.isCompared);
  return (
    <div className="flex w-full items-start py-2">
      <div className="min-w-0 grow">
        <ForkRow
          view={view}
          index={example.index}
          count={example.count}
          timeWidth={scale.axisX - row.beadClear / 2}
          wordsLeft={scale.axisX + row.beadClear}
          drawing={DEFAULT_DRAWING}
          lineAt={isPhone ? "under" : "margin"}
          onChoose={ignore}
          onCompare={ignore}
          onAskAgain={ignore}
        />
      </div>
      {isLineInMargin && (
        <div className="w-label shrink-0 pl-4 type-note">
          <ForkLine view={view} onAskAgain={ignore} />
        </div>
      )}
    </div>
  );
}

const firstExample = FORK_EXAMPLES[0]?.example;
const firstMoment = FORK_MOMENTS[0]?.moment;
if (!firstExample || !firstMoment) throw new Error("The fork row's matrix needs its examples");

/**
 * A changed word's fork row (`docs/decisions.md`, "A changed word proposes its part beside the
 * day, and the visitor takes it"): each moment down, from the press to a choice and a failure,
 * and across, Elche's two parts, Kanazawa's one and a whole day, then the longer answers the
 * vocabularies allow: "home by eleven" and "home by eight" beside the fork's time, "with a
 * partner" and "with friends", and the longest pair, "getting around …" and "by public
 * transport". Where a phone's line cannot hold both, the proposal's answer wraps under the
 * visitor's as a whole, from the press, so the row's room never changes as it becomes whole.
 */
export const FORK_ROW_MATRIX = labMatrix<ForkRowCellProps>({
  key: "fork-row",
  title: "Fork row",
  note: "A changed word's two answers over the part it rewrites: written, ready, taken, left, compared and failed, a part of two, a part alone, a whole day and the longest answers",
  base: { example: firstExample, moment: firstMoment },
  axes: [
    {
      name: "moment",
      values: FORK_MOMENTS.map(({ label, moment }) => ({ label, props: { moment } })),
    },
    {
      name: "example",
      values: FORK_EXAMPLES.map(({ label, example }) => ({ label, props: { example } })),
    },
  ],
  render: (props, width) => <ForkRowCell {...props} isPhone={width === "phone"} />,
});
