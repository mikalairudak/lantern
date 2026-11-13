import { cn } from "@/components/ui/cn";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayStageHeaderCell, type DayStageHeaderCellProps } from "./day-stage-header-cell";
import { HEADER_DAYS, HEADER_MOMENTS, isListOpenAt } from "./day-stage-header-examples";

/**
 * The page's gutter on a laptop, whose page column (`max-w-page`) holds the masthead 1024 px
 * wide inside it, and the head under it at the plan's width. A phone cell holds the phone's own
 * gutters (`matrix-view.tsx`).
 */
const LAPTOP_GUTTER_CLASSES = "px-16";

/**
 * The day's header in every moment the product sets it in, from the visitor's words alone
 * to each ending, on five days. The header says the same at every width and energy, so
 * there is no density axis: its density is the one the page gives it.
 */
export const DAY_STAGE_HEADER_MATRIX: LabMatrix = labMatrix<DayStageHeaderCellProps>({
  // The header's first name: the baseline's file names are built from the key, so it stays.
  key: "written-header",
  title: "Day stage header",
  note: "The day's header from the visitor's words to every ending, and through a word's re-plan and after. It has one density, so no density axis. The wide screen is a laptop's page column in its gutter, so the masthead is 1024 px wide and the head under it 768, as on a 1280 px laptop; its type follows the screen, so a laptop's lines are read on a laptop's screen. The day head matrix sets it at 1024, 1280 and 1440 px",
  base: { moment: "asked", day: 0 },
  axes: [
    {
      name: "moment",
      values: HEADER_MOMENTS.map(({ label, key }) => ({ label, props: { moment: key } })),
    },
    {
      name: "day",
      values: HEADER_DAYS.map(({ label }, day) => ({ label, props: { day } })),
    },
  ],
  // In the day's own gutter, as the page sets it on a phone or a laptop. Positioned, so the
  // header's unseen status line stays inside its cell and the grid, not the page, scrolls
  // sideways.
  // A word's list drawn open hangs below the header, so its cell makes room under it.
  render: (props, width) => (
    <div
      className={cn(
        "relative",
        width === "wide" && LAPTOP_GUTTER_CLASSES,
        isListOpenAt(props.moment) && "pb-day",
      )}
    >
      <DayStageHeaderCell {...props} />
    </div>
  ),
  wide: "page",
  // Every moment on the hero day and every day at the visitor's words: the grid's default
  // view would also shoot the moments a day never reaches, which only say so.
  baseline: [
    { rows: 0, columns: 0 },
    { rows: 1, columns: 1 },
  ],
});
