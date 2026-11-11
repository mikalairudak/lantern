import { cn } from "@/components/ui/cn";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayStageHeaderCell, type DayStageHeaderCellProps } from "./day-stage-header-cell";
import { FirstImpressionProvider } from "./first-impression";
import { HEADER_DAYS, HEADER_MOMENTS, isListOpenAt } from "./day-stage-header-examples";

/**
 * The page's gutter on a laptop, whose page column (`max-w-page`) holds the header 1024 px
 * wide inside it. A phone cell holds the phone's own gutters (`matrix-view.tsx`).
 */
const LAPTOP_GUTTER_CLASSES = "px-16";

/**
 * The day's header in every moment the product sets it in, from the visitor's words alone
 * to each ending, on five days. The header says the same at every width and energy, so
 * there is no density axis: its density is the one the page gives it.
 */
type HeaderMatrixProps = DayStageHeaderCellProps & { isFirstImpression: boolean };

export const DAY_STAGE_HEADER_MATRIX: LabMatrix = labMatrix<HeaderMatrixProps>({
  // The header's first name: the baseline's file names are built from the key, so it stays.
  key: "written-header",
  title: "Day stage header",
  note: "The day's header from the visitor's words to every ending, and through a word's re-plan and after. It has one density, so no density axis. The wide screen is a laptop's page column in its gutter, so the header is 1024 px wide, as on a laptop; its type follows the screen, so a laptop's lines are read on a laptop's screen",
  base: { moment: "asked", day: 0, isFirstImpression: false },
  axes: [
    {
      name: "moment",
      values: HEADER_MOMENTS.map(({ label, key }) => ({ label, props: { moment: key } })),
    },
    {
      name: "day",
      values: HEADER_DAYS.map(({ label }, day) => ({ label, props: { day } })),
    },
    {
      // The first impression's headline: "with anyone", Lantern's words dotted in muted ink,
      // the lead lighter and the hint a caption (`docs/decisions.md`, "A day opens on its plan,
      // lit by the day's light"), noted on the cell's own box as the root layout notes it.
      name: "look",
      values: [
        { label: "today's", props: { isFirstImpression: false } },
        { label: "the first impression's", props: { isFirstImpression: true } },
      ],
    },
  ],
  // In the day's own gutter, as the page sets it on a phone or a laptop. Positioned, so the
  // header's unseen status line stays inside its cell and the grid, not the page, scrolls
  // sideways.
  // A word's list drawn open hangs below the header, so its cell makes room under it.
  render: ({ isFirstImpression, ...props }, width) => (
    <FirstImpressionProvider isOn={isFirstImpression}>
      <div
        data-first-impression={isFirstImpression ? "" : undefined}
        className={cn(
          "relative",
          width === "wide" && LAPTOP_GUTTER_CLASSES,
          isListOpenAt(props.moment) && "pb-day",
        )}
      >
        <DayStageHeaderCell {...props} />
      </div>
    </FirstImpressionProvider>
  ),
  wide: "page",
  // Every moment on the hero day and every day at the visitor's words: the grid's default
  // view would also shoot the moments a day never reaches, which only say so.
  baseline: [
    { rows: 0, columns: 0 },
    { rows: 1, columns: 1 },
  ],
});
