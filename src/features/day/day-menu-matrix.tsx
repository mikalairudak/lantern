import { labMatrix, type LabMatrix } from "@/lib/lab-matrix";
import { DayMenu, type DayMenuItem } from "./day-menu";
import { DAY_MENU_STATES } from "./day-menu-examples";
import { FirstImpressionProvider } from "./first-impression";
import { Masthead } from "./masthead";

interface DayMenuCellProps {
  page: "day" | "start" | "action";
  items: DayMenuItem[];
  isOpen: boolean;
}

/**
 * The first impression's masthead (`docs/decisions.md`, "The day's ways along live in one menu,
 * in the masthead"): on a day, the menu "Take this day" in the group on the right, closed and
 * open in each state of the day; on the start screen the theme alone; on a page with an action,
 * the action.
 */
export const DAY_MENU_MATRIX: LabMatrix = labMatrix<DayMenuCellProps>({
  key: "day-menu",
  title: "The masthead and the day menu",
  note: "The wordmark as one unit, and the day's ways along in one menu, closed and open",
  base: { page: "day", items: DAY_MENU_STATES[0]!.items, isOpen: true },
  wide: "page",
  axes: [
    {
      name: "menu",
      values: DAY_MENU_STATES.map(({ label, items }) => ({ label, props: { items } })),
    },
    {
      name: "page",
      values: [
        { label: "a day, its menu open", props: { page: "day", isOpen: true } },
        { label: "a day, its menu closed", props: { page: "day", isOpen: false } },
        { label: "the start screen", props: { page: "start", isOpen: false } },
        { label: "a page with an action", props: { page: "action", isOpen: false } },
      ],
    },
  ],
  render: ({ page, items, isOpen }) => (
    <FirstImpressionProvider isOn>
      <div className="flex flex-col">
        <Masthead
          isHome={page === "start"}
          action={page === "action" ? <span>Plan your own day</span> : undefined}
          menu={page === "day" ? <DayMenu items={items} isOpenAtFirst={isOpen} /> : undefined}
        />
        {/* Room under an open menu, which hangs over the page below the masthead. */}
        {isOpen && page === "day" && <div aria-hidden className="h-day" />}
      </div>
    </FirstImpressionProvider>
  ),
});
