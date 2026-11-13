import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayMenu } from "./day-menu";
import { DAY_MENU_STATES, type DayMenuState } from "./day-menu-examples";
import { Masthead } from "./masthead";

type DayMenuCellProps = Omit<DayMenuState, "label">;

/**
 * The masthead (`docs/decisions.md`, "The day's ways along live in one menu,
 * in the masthead"): on a day, the menu "Take this day" in the group on the right, closed and
 * open in each state of the day; on the start screen the theme alone.
 */
export const DAY_MENU_MATRIX: LabMatrix = labMatrix<DayMenuCellProps>({
  key: "day-menu",
  title: "The masthead and the day menu",
  note: "The wordmark as one unit, and the day's ways along in one menu, closed and open",
  base: { page: "day", items: DAY_MENU_STATES[0]!.items, isOpen: true },
  wide: "page",
  axes: [
    {
      name: "state",
      values: DAY_MENU_STATES.map(({ label, ...props }) => ({ label, props })),
    },
  ],
  render: ({ page, items, isOpen, pointedKey }) => (
    <div className="flex flex-col">
      <Masthead
        isHome={page === "start"}
        menu={
          page === "day" ? (
            <DayMenu items={items} isOpenAtFirst={isOpen} pointedKey={pointedKey} />
          ) : undefined
        }
      />
      {/* Room under an open menu, which hangs over the page below the masthead. */}
      {isOpen && page === "day" && <div aria-hidden className="h-day" />}
    </div>
  ),
});
