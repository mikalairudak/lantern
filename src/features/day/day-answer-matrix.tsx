import type { DayAnswer } from "@/lib/events/event.schema";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DAY_END_EXAMPLES } from "./day-end-examples";
import { DayEnd } from "./day-end-line";

interface DayAnswerCellProps {
  answered: DayAnswer | null;
  isCut: boolean;
}

const KANAZAWA = DAY_END_EXAMPLES[0]!;
const ignore = () => undefined;

/**
 * The one-tap answer at a day's end (`docs/decisions.md`, "A day's end asks one question,
 * answered in one tap"): under the first impression's day end, the question, each answer's
 * thanks in its place, and a day cut short, which is not asked.
 */
export const DAY_ANSWER_MATRIX: LabMatrix = labMatrix<DayAnswerCellProps>({
  key: "day-answer",
  title: "The day's end answer",
  note: "“Would you follow this day? Yes · Not quite” under the day's summary, the thanks in its place once answered, and nothing asked of a day cut short",
  base: { answered: null, isCut: false },
  wide: "abacus",
  axes: [
    {
      name: "state",
      values: [
        { label: "asked", props: { answered: null, isCut: false } },
        { label: "answered yes", props: { answered: "yes", isCut: false } },
        { label: "answered not quite", props: { answered: "not-quite", isCut: false } },
        { label: "a day cut short: no question", props: { answered: null, isCut: true } },
      ],
    },
  ],
  render: ({ answered, isCut }) => (
    <DayEnd
      {...KANAZAWA}
      isCut={isCut}
      calendarKey="kanazawa"
      hasWaysAlong={false}
      onAnswer={ignore}
      answeredAtFirst={answered}
    />
  ),
});
