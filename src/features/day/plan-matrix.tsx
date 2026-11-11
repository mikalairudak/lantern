import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { FirstImpressionProvider } from "./first-impression";
import { READING_DAYS, READING_STATES, type ReadingState } from "./reading-list-examples";
import { ReadingListCell } from "./reading-list-cell";

type PlanProps = { day: number; state: ReadingState };

/**
 * The day's plan under the first impression (`docs/decisions.md`, "A day opens on its plan, lit
 * by the day's light"): the reading list's own cells, from the same real stream, with the rail of
 * the day's light beside the times and the sun's minutes where they fall. Every state and day the
 * list has, so twelve stops, one stop, a night past midnight and a proposal are drawn too.
 */
export const PLAN_MATRIX: LabMatrix = labMatrix<PlanProps>({
  key: "plan",
  title: "The day's plan",
  note: "The list as the day's plan: the rail of the day's light down the times, golden hour in the lamp, dusk and night dotted, the sun's minutes where they fall",
  base: { day: 0, state: "whole" },
  axes: [
    {
      name: "state",
      values: READING_STATES.map(({ key, label }) => ({ label, props: { state: key } })),
    },
    {
      name: "day",
      values: READING_DAYS.map(({ label }, day) => ({ label, props: { day } })),
    },
  ],
  wide: "abacus",
  // States down, days across: the default view, shot on purpose.
  baseline: [{ rows: 0, columns: 1 }],
  render: ({ day, state }) => (
    <FirstImpressionProvider isOn>
      <div data-first-impression="">
        <ReadingListCell day={day} state={state} />
      </div>
    </FirstImpressionProvider>
  ),
});
