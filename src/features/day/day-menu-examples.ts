import { COPY_LINK, LINK_COPIED } from "./day-export-words";
import type { DayExports } from "./day-exports";
import { DAY_END_EXAMPLES } from "./day-end-examples";
import type { DayMenuItem } from "./day-menu";
import { takeAlongOf } from "./take-along";

const KANAZAWA = DAY_END_EXAMPLES[0]!;
const ignore = () => undefined;

function exportsOf(copied: DayExports["copied"]): DayExports {
  return { copied, sendLink: async () => undefined, saveCalendar: ignore };
}

const PLAN_ANOTHER: DayMenuItem = {
  key: "another",
  label: "Plan another day",
  note: "Ask for a day somewhere else",
  isApart: true,
};

function itemsOf(options: Partial<Parameters<typeof takeAlongOf>[0]>): DayMenuItem[] {
  return [
    ...takeAlongOf({
      day: KANAZAWA.day,
      shown: KANAZAWA.shown,
      checks: KANAZAWA.checks,
      isCut: false,
      exports: exportsOf(COPY_LINK),
      onRoute: ignore,
      hasLink: true,
      ...options,
    }),
    PLAN_ANOTHER,
  ];
}

/** Which masthead a cell draws: a day's with its menu, the start screen's, or a page's action. */
export type MastheadPage = "day" | "start" | "action";

export interface DayMenuState {
  label: string;
  page: MastheadPage;
  items: DayMenuItem[];
  isOpen: boolean;
}

/** The masthead and its menu in each state worth a look, on Kanazawa's written day. */
export const DAY_MENU_STATES: readonly DayMenuState[] = [
  { label: "a day, its menu open", page: "day", items: itemsOf({}), isOpen: true },
  { label: "a day, its menu closed", page: "day", items: itemsOf({}), isOpen: false },
  {
    label: "while the day is written",
    page: "day",
    items: itemsOf({ day: null }),
    isOpen: true,
  },
  {
    label: "its link just copied",
    page: "day",
    items: itemsOf({ exports: exportsOf(LINK_COPIED) }),
    isOpen: true,
  },
  { label: "a day cut short", page: "day", items: itemsOf({ isCut: true }), isOpen: true },
  {
    label: "a stream that ended without a day",
    page: "day",
    items: [{ ...PLAN_ANOTHER, isApart: false }],
    isOpen: true,
  },
  { label: "the start screen", page: "start", items: [], isOpen: false },
  { label: "a page with an action", page: "action", items: [], isOpen: false },
];
