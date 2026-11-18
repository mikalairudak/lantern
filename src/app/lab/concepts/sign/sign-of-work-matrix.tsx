import { cn } from "@/components/ui/cn";
import { SignOfWork } from "@/components/ui/sign-of-work";
import { SIGN_RIBS, type SignWork } from "@/components/ui/sign-tally";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { SIGN_LOOP_SECONDS, SIGN_MOMENTS, type SignMoment } from "@/lib/tokens/motion";

/** Where the sign stands: alone, or in the start screen's button as it frames it. */
export type SignPlace = "alone" | "button";

export interface SignCellProps {
  work: SignWork;
  heldAt?: SignMoment;
  place: SignPlace;
}

/** The start button's frame while Lantern works: the hollow button's, in ink, 32 px square. */
const PLACE_CLASSES: Readonly<Record<SignPlace, string>> = {
  alone: "inline-grid size-8 place-items-center",
  button: "inline-grid size-8 place-items-center rounded-sm border border-ink",
};

/** The sign where it stands, the drawing 24 px. */
export function SignCell({ work, heldAt, place }: SignCellProps) {
  return (
    <span className={cn(PLACE_CLASSES[place])}>
      <SignOfWork work={work} heldAt={heldAt} className="size-6" />
    </span>
  );
}

const MOMENT_LABELS: Readonly<Record<SignMoment, string>> = {
  uncut: "the lantern uncut",
  cutting: "the pen on its second rib",
  wick: "the wick lit",
  swelling: "the light swelling",
  litBeforeRibs: "lit, its ribs coming through",
  litWhole: "lit whole, at rest",
  puttingOut: "put out, the light falling back",
  withdrawing: "the paper withdrawing to its wick",
};

const MOMENT_VALUES = (Object.keys(SIGN_MOMENTS) as SignMoment[]).map((moment) => ({
  label: `${SIGN_MOMENTS[moment]} of ${SIGN_LOOP_SECONDS} s: ${MOMENT_LABELS[moment]}`,
  props: { work: { kind: "running" }, heldAt: moment } satisfies Partial<SignCellProps>,
}));

const RIB_VALUES = Array.from({ length: SIGN_RIBS + 1 }, (_, ribs) => ({
  label: ribs === 0 ? "tally: the outline alone" : `tally: ${ribs} of ${SIGN_RIBS} ribs`,
  props: { work: { kind: "cut", ribs } } satisfies Partial<SignCellProps>,
}));

const PLACE_AXIS = {
  name: "place",
  values: [
    { label: "alone", props: { place: "alone" } },
    { label: "in the start button", props: { place: "button" } },
  ],
} as const satisfies {
  name: string;
  values: readonly { label: string; props: Partial<SignCellProps> }[];
};

/**
 * The sign of work's tally (`SignOfWork`), each state it keeps with no loop, alone and in the
 * start button's frame: what stands under reduced motion.
 */
export const SIGN_OF_WORK_MATRIX: LabMatrix = labMatrix<SignCellProps>({
  key: "sign-of-work",
  title: "The sign of work",
  note: "A paper lantern cut in one stroke of the pen and lit from its wick: the tally it keeps with no loop",
  base: { work: { kind: "cut", ribs: 0 }, place: "alone" },
  axes: [
    {
      name: "tally",
      values: [
        ...RIB_VALUES,
        { label: "tally: ribs and wick", props: { work: { kind: "wick" } } },
        { label: "tally: lit whole", props: { work: { kind: "lit" } } },
      ],
    },
    PLACE_AXIS,
  ],
  render: (props) => <SignCell {...props} />,
});

/**
 * The sign of work's loop held at eight moments, each paused where the loop passes, alone and
 * in the start button's frame. Out of the visual baseline: a screenshot there cancels every
 * endless animation, a paused one too, so each held cell would be shot as the outline alone.
 */
export const SIGN_OF_WORK_LOOP_MATRIX: LabMatrix = labMatrix<SignCellProps>({
  key: "sign-of-work-loop",
  title: "The sign of work, its loop held",
  note: "The sign's loop paused at eight moments, where it is cut, lit, at rest and put out",
  base: { work: { kind: "running" }, place: "alone" },
  axes: [{ name: "moment", values: MOMENT_VALUES }, PLACE_AXIS],
  render: (props) => <SignCell {...props} />,
  baseline: [],
});
