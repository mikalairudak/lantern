import { cn } from "@/components/ui/cn";
import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayMenu } from "./day-menu";
import { DAY_MENU_STATES } from "./day-menu-examples";
import { Masthead } from "./masthead";
import { NewDayButton } from "./new-day";

/** Which masthead a cell draws: a day's with ways to take it along, one with none, the start's. */
type MastheadKind = "day" | "no-way-along" | "start";

interface MastheadCellProps {
  kind: MastheadKind;
  isOpen: boolean;
  newDay: "rest" | "pointed" | "focused" | "locked";
  /** The row set under `@masthead`, 320 px as a 320 px phone's. */
  isShortRow: boolean;
}

/** Kanazawa's ways along, and the new day as the menu's last row, as the day's header gives them. */
const ITEMS = DAY_MENU_STATES[0]!.items;

const ignore = () => undefined;

/**
 * The masthead's three kinds (`docs/decisions.md`, "The day's ways along live in one menu, in
 * the masthead"): this day's menu, the new day in words a step quieter, and the theme, parted by
 * space alone. A phone's cell is a row of 358 px, which holds the three; the short row is a cell
 * of its own, a row of 320 px under `@masthead` at any value the token can take. The threshold
 * itself is held by an e2e at the token's width, not by a cell.
 */
export const MASTHEAD_MATRIX: LabMatrix = labMatrix<MastheadCellProps>({
  key: "masthead",
  title: "The masthead's three kinds",
  note: "This day's menu, a new day and the theme, side by side where the row holds them",
  base: { kind: "day", isOpen: false, newDay: "rest", isShortRow: false },
  wide: "page",
  axes: [
    {
      name: "state",
      values: [
        { label: "at rest", props: {} },
        { label: "the new day pointed at", props: { newDay: "pointed" } },
        { label: "the new day focused by keys", props: { newDay: "focused" } },
        { label: "while a re-plan is written: the new day locked", props: { newDay: "locked" } },
        { label: "the menu open, hung from its own words", props: { isOpen: true } },
        { label: "no way along: the new day and the theme", props: { kind: "no-way-along" } },
        { label: "the start screen: the theme alone", props: { kind: "start" } },
        { label: "the short row: the menu and the theme", props: { isShortRow: true } },
        {
          label: "the short row, its menu open: four rows",
          props: { isShortRow: true, isOpen: true },
        },
        {
          label: "the short row with no way along",
          props: { isShortRow: true, kind: "no-way-along" },
        },
      ],
    },
  ],
  render: ({ kind, isOpen, newDay, isShortRow }) => {
    const isDay = kind !== "start";
    const hasWaysAlong = kind === "day";
    return (
      <div className={cn("flex flex-col", isShortRow && "max-w-intro")}>
        <Masthead
          isHome={!isDay}
          menu={hasWaysAlong && <DayMenu items={ITEMS} isOpenAtFirst={isOpen} />}
          newDay={
            isDay && (
              <NewDayButton
                onPress={ignore}
                isLocked={newDay === "locked"}
                isPointedDrawn={newDay === "pointed"}
                isFocusDrawn={newDay === "focused"}
                isAlwaysInRow={!hasWaysAlong}
              />
            )
          }
        />
        {/* Room under an open menu, which hangs over the page below the masthead. */}
        {isOpen && <div aria-hidden className="h-day" />}
      </div>
    );
  },
});
