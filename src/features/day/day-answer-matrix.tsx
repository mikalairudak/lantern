import { cn } from "@/components/ui/cn";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DAY_END_EXAMPLES } from "./day-end-examples";
import { DayEnd } from "./day-end-line";

interface DayAnswerCellProps {
  isAnswered: boolean;
  isCut: boolean;
  /** A day whose places were checked, with its "found" line, or one written by hand without. */
  hasFoundLine: boolean;
  /** Set in 320 px, a phone's narrowest, where the answers wrap under the question. */
  isNarrow: boolean;
}

const CHECKED = DAY_END_EXAMPLES[0]!;
const BY_HAND =
  DAY_END_EXAMPLES.find(({ label }) => label.startsWith("written by hand")) ?? CHECKED;
const ignore = () => undefined;

/**
 * The one-tap answer at a day's end (`docs/decisions.md`, "A day's end asks one question,
 * answered in one tap"): under the day's end, the question, the thanks in its
 * place once answered (one thanks for either answer), a day cut short, which is not asked, a day
 * with no "found" line, and the narrowest phone, where the answers wrap under the question.
 */
export const DAY_ANSWER_MATRIX: LabMatrix = labMatrix<DayAnswerCellProps>({
  key: "day-answer",
  title: "The day's end answer",
  note: "“Would you follow this day? Yes · Not quite” under the day's summary, the thanks in its place once answered, and nothing asked of a day cut short",
  base: { isAnswered: false, isCut: false, hasFoundLine: true, isNarrow: false },
  wide: "abacus",
  axes: [
    {
      name: "state",
      values: [
        { label: "asked", props: { isAnswered: false, isCut: false } },
        { label: "answered", props: { isAnswered: true, isCut: false } },
        { label: "a day cut short: no question", props: { isAnswered: false, isCut: true } },
      ],
    },
    {
      name: "day",
      values: [
        { label: "its places checked", props: { hasFoundLine: true, isNarrow: false } },
        {
          label: "written by hand: no found line",
          props: { hasFoundLine: false, isNarrow: false },
        },
        { label: "in 320 px", props: { hasFoundLine: true, isNarrow: true } },
      ],
    },
  ],
  render: ({ isAnswered, isCut, hasFoundLine, isNarrow }) => (
    <div className={cn(isNarrow && "max-w-intro")}>
      <DayEnd
        {...(hasFoundLine ? CHECKED : BY_HAND)}
        isCut={isCut}
        calendarKey="kanazawa"
        hasWaysAlong={false}
        onAnswer={ignore}
        answered={isAnswered ? "yes" : null}
      />
    </div>
  ),
});
