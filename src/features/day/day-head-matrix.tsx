import { cn } from "@/components/ui/cn";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayHeadCell, type DayHeadCellProps } from "./day-head-cell";
import { HEADER_DAYS, isListOpenAt, type HeaderMoment } from "./day-stage-header-examples";

/** The day the widths are read on: Lisbon, whose line about the day is the longest. */
const LONGEST_DAY = HEADER_DAYS.findIndex(({ label }) => label.startsWith("Lisbon"));

/** The head's moments a laptop's width can change: before the model, while it writes, after. */
const MOMENTS: readonly { label: string; moment: HeaderMoment }[] = [
  { label: "nothing yet: the visitor's words alone", moment: "asked" },
  { label: "partly streamed: Lantern's words", moment: "words" },
  { label: "partly streamed: the line about the day, mid-word", moment: "dek" },
  { label: "complete, with the hint", moment: "written" },
  { label: "a word's list open", moment: "replan-writing-list" },
  { label: "cut before a day", moment: "cut" },
  { label: "disconnected", moment: "disconnected" },
  { label: "refused", moment: "refused" },
  { label: "unavailable", moment: "unavailable" },
  { label: "resting, at our own limit", moment: "limited" },
  { label: "at the day's own address, still being written", moment: "kept-writing" },
  { label: "at the day's own address, its link expired", moment: "kept-expired" },
];

/**
 * A laptop's screen inside the wide cell, which is the page's column (`max-w-page`, 1152 px):
 * at 1280 and 1440 px the page is that column in its gutters, so the masthead is 1024 px wide;
 * at 1024 px the page is the screen, the column less a gutter each side, in the same gutters,
 * so the masthead is 896 px. The root grows only past 1440 px, so 1440 sets as 1280 does.
 */
const SCREENS: readonly { label: string; classes: string }[] = [
  { label: "1024 px", classes: "px-16" },
  { label: "1280 px", classes: "" },
  { label: "1440 px", classes: "" },
];

/** The page's gutter on a laptop (`day-stage.tsx`). A phone cell holds the phone's own. */
const LAPTOP_GUTTER_CLASSES = "px-16";

/**
 * The day's head at a laptop's widths: the masthead at the page's, the head at the plan's,
 * whichever view is on show. The view is the page's, noted on `<html>`, so the plan's bar
 * under a written day's head switches every cell between the plan and the chart, as on a day.
 */
export const DAY_HEAD_MATRIX: LabMatrix = labMatrix<DayHeadCellProps & { screen: number }>({
  key: "day-head",
  title: "Day head at a laptop's widths",
  note: "The day's head at 1024, 1280 and 1440 px, on Lisbon's longest line: the masthead at the page's width, the head under it at the plan's, from nothing yet to each ending. Under a written day the plan's bar marks the plan's edge; its Plan · Chart switches every cell's view, which moves no line of the head. Set the wide screen: a phone cell is the page as a phone has it",
  base: { moment: "asked", day: LONGEST_DAY, screen: 1 },
  axes: [
    {
      name: "moment",
      values: MOMENTS.map(({ label, moment }) => ({ label, props: { moment } })),
    },
    {
      name: "screen",
      values: SCREENS.map(({ label }, screen) => ({ label, props: { screen } })),
    },
  ],
  // Positioned, so the header's unseen status line stays inside its cell. A word's list
  // drawn open hangs below the head, so its cell makes room under it.
  render: ({ screen, ...props }, width) => (
    <div
      className={cn(
        "relative",
        width === "wide" && SCREENS[screen]?.classes,
        isListOpenAt(props.moment) && "pb-day",
      )}
    >
      <div className={cn(width === "wide" && LAPTOP_GUTTER_CLASSES)}>
        <DayHeadCell {...props} />
      </div>
    </div>
  ),
  wide: "page",
  // Its point is a laptop's widths, which the baseline, shot at a phone's, does not reach;
  // its phone cells are the day stage header's.
  baseline: [],
});
